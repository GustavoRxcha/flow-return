import { createHmac, timingSafeEqual } from 'node:crypto'
import { Hono } from 'hono'
import { metaChannel, type SendChannel } from '../src/lib/channel.ts'
import { phoneFromWhatsApp } from '../src/lib/phone.ts'
import { AiUnavailable, type ChatModel } from './ai.ts'
import { assistantTurn, MAX_ASSISTANT_TEXT } from './assistant.ts'
import type { Db } from './db.ts'
import { getReturnClient } from './repo.ts'

/** Mensagem recebida, igual para qualquer provedor. Trocar de WhatsApp é trocar quem preenche isto e o SendChannel. */
export interface IncomingMessage {
  id: string
  /** A linha do negócio que recebeu a mensagem. */
  line: string
  /** Número como o WhatsApp entrega. A resposta volta para ele. */
  from: string
  /** Null quando chega áudio, foto ou outro conteúdo sem texto. */
  text: string | null
}

const NOT_TEXT_REPLY = 'Por aqui só consigo ler mensagens de texto. Pode escrever o que você precisa?'
const OFFLINE_REPLY = 'Não consegui responder agora. Pode mandar de novo daqui a alguns minutos?'
const MEDIA_TYPES = new Set(['audio', 'image', 'video', 'document', 'sticker', 'location', 'contacts'])
const RECEIVED_TTL_MS = 7 * 24 * 60 * 60 * 1000

/** Lê o aviso da Meta. Confirmações de entrega e reações ficam de fora. */
export function parseMetaWebhook(payload: unknown): IncomingMessage[] {
  const { entry } = (payload ?? {}) as { entry?: Array<{ changes?: Array<{ field?: string; value?: MetaValue }> }> }
  return (entry ?? []).flatMap(({ changes }) =>
    (changes ?? []).flatMap(({ field, value }) => {
      const line = value?.metadata?.phone_number_id
      if (field !== 'messages' || !line) return []
      return (value?.messages ?? []).flatMap(({ id, from, type, text }): IncomingMessage[] => {
        if (type === 'text' && text?.body) return [{ id, line, from, text: text.body }]
        return MEDIA_TYPES.has(type) ? [{ id, line, from, text: null }] : []
      })
    }),
  )
}

interface MetaValue {
  metadata?: { phone_number_id?: string }
  messages?: Array<{ id: string; from: string; type: string; text?: { body?: string } }>
}

/** Só a Meta conhece a chave secreta do app. Sem esta conferência, qualquer um falaria em nome de um cliente. */
export function isSignedByMeta(body: string, signature: string | undefined, appSecret: string): boolean {
  const expected = Buffer.from(`sha256=${createHmac('sha256', appSecret).update(body).digest('hex')}`)
  const received = Buffer.from(signature ?? '')
  return received.length === expected.length && timingSafeEqual(received, expected)
}

export function linkLine(db: Db, line: string, returnClientId: string): void {
  db.prepare(
    `INSERT INTO whatsapp_lines (line_id, return_client_id) VALUES (?, ?)
     ON CONFLICT(line_id) DO UPDATE SET return_client_id = excluded.return_client_id`,
  ).run(line, returnClientId)
}

function businessOfLine(db: Db, line: string): string | null {
  const row = db.prepare('SELECT return_client_id FROM whatsapp_lines WHERE line_id = ?').get(line) as { return_client_id: string } | undefined
  if (!row || getReturnClient(db, row.return_client_id)?.status !== 'ativo') return null
  return row.return_client_id
}

/** A Meta reenvia o que achar que falhou. Cada mensagem só pode ser respondida uma vez. */
function isFirstTime(db: Db, messageId: string, now: number): boolean {
  db.prepare('DELETE FROM whatsapp_received WHERE received_at < ?').run(now - RECEIVED_TTL_MS)
  return db.prepare('INSERT OR IGNORE INTO whatsapp_received (message_id, received_at) VALUES (?, ?)').run(messageId, now).changes === 1
}

export function createInbox(db: Db, channelFor: (line: string) => SendChannel, chat?: ChatModel) {
  /** Mensagens esperando resposta por conversa. Quem manda três seguidas recebe uma resposta só. */
  const waiting = new Map<string, string[]>()

  async function answer(key: string, returnClientId: string, phone: string, { from, line }: IncomingMessage): Promise<void> {
    const texts = waiting.get(key)!
    while (texts.length) {
      const text = texts.splice(0).join('\n').slice(0, MAX_ASSISTANT_TEXT)
      const reply = await assistantTurn(db, returnClientId, `whatsapp:${phone}`, text, { phone, chat })
        .then(({ reply }) => reply)
        .catch((failure: unknown) => {
          if (failure instanceof AiUnavailable) return OFFLINE_REPLY
          throw failure
        })
      await channelFor(line).send({ phone: from, text: reply })
    }
  }

  return {
    async receive(message: IncomingMessage): Promise<void> {
      const returnClientId = businessOfLine(db, message.line)
      const phone = phoneFromWhatsApp(message.from)
      if (!returnClientId || !phone || !isFirstTime(db, message.id, Date.now())) return
      if (message.text === null) {
        await channelFor(message.line).send({ phone: message.from, text: NOT_TEXT_REPLY })
        return
      }
      const key = `${returnClientId}:${phone}`
      const texts = waiting.get(key)
      if (texts) {
        texts.push(message.text)
        return
      }
      waiting.set(key, [message.text])
      await answer(key, returnClientId, phone, message).finally(() => waiting.delete(key))
    },
  }
}

export type Inbox = ReturnType<typeof createInbox>

/** Endereço que a Meta chama. Responde na hora e a atendente segue em segundo plano, porque a IA pode levar um minuto. */
export function whatsappWebhook(inbox: Inbox, { verifyToken, appSecret }: { verifyToken: string; appSecret: string }) {
  const app = new Hono()

  app.get('/webhooks/whatsapp', (c) => {
    const valid = c.req.query('hub.mode') === 'subscribe' && c.req.query('hub.verify_token') === verifyToken
    return valid ? c.text(c.req.query('hub.challenge') ?? '') : c.text('', 403)
  })

  app.post('/webhooks/whatsapp', async (c) => {
    const body = await c.req.text()
    if (!isSignedByMeta(body, c.req.header('x-hub-signature-256'), appSecret)) return c.text('', 401)
    for (const message of parseMetaWebhook(JSON.parse(body))) {
      inbox.receive(message).catch((failure: unknown) => {
        console.error(`WhatsApp: ${failure instanceof Error ? failure.name : 'erro'}. ${failure instanceof Error && failure.name === 'SendFailed' ? failure.message : ''}`)
      })
    }
    return c.text('ok')
  })

  return app
}

/** Liga o WhatsApp a partir do .env. Sem todos os dados, ele fica desligado. */
export function startWhatsApp(db: Db) {
  const { WHATSAPP_PHONE_NUMBER_ID: line, WHATSAPP_ACCESS_TOKEN: accessToken, WHATSAPP_APP_SECRET: appSecret, WHATSAPP_VERIFY_TOKEN: verifyToken, WHATSAPP_NEGOCIO: business } = process.env
  if (!line || !accessToken || !appSecret || !verifyToken || !business) return null
  const row = db.prepare('SELECT id FROM return_clients WHERE name = ?').get(business) as { id: string } | undefined
  if (!row) {
    console.log('WhatsApp desligado: o negócio do .env não existe.')
    return null
  }
  linkLine(db, line, row.id)
  return whatsappWebhook(createInbox(db, (id) => metaChannel(id, accessToken)), { verifyToken, appSecret })
}
