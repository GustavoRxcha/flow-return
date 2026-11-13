import { createHmac } from 'node:crypto'
import { beforeEach, describe, expect, it } from 'vitest'
import { AiUnavailable, type ChatModel } from './ai.ts'
import { openDb, type Db } from './db.ts'
import { loadState } from './repo.ts'
import { seedIfEmpty, TEST_ACCOUNTS } from './seed.ts'
import { createInbox, isSignedByMeta, linkLine, parseMetaWebhook, whatsappWebhook, type Inbox } from './whatsapp.ts'
import { phoneFromWhatsApp } from '../src/lib/phone.ts'
import { todayIso } from '../src/lib/dates.ts'
import type { OutgoingMessage, SendChannel } from '../src/lib/channel.ts'

const SECRET = 'segredo-de-teste'
const LINE = 'linha-1'
const payload = (messages: unknown[], line = LINE) => ({ entry: [{ changes: [{ field: 'messages', value: { metadata: { phone_number_id: line }, messages } }] }] })
const textMessage = (id: string, body: string, from = '5511977776666') => ({ id, from, type: 'text', text: { body } })
const incoming = (id: string, text: string | null, from = '5511977776666') => ({ id, line: LINE, from, text })

let db: Db
let businessId: string
let sent: OutgoingMessage[]
const channel: SendChannel = {
  id: 'teste',
  async send(message) {
    sent.push(message)
    return { kind: 'sent' }
  },
}
const answers = (content: string): ChatModel => async () => ({ content, toolCalls: [] })
const inbox = (chat: ChatModel): Inbox => createInbox(db, () => channel, chat)

beforeEach(() => {
  db = openDb(':memory:')
  seedIfEmpty(db, todayIso())
  const row = db.prepare('SELECT return_client_id FROM users WHERE email = ?').get(TEST_ACCOUNTS.barbearia.email) as { return_client_id: string }
  businessId = row.return_client_id
  linkLine(db, LINE, businessId)
  sent = []
})

describe('leitura do aviso da Meta', () => {
  it('traz texto e marca o que não é texto', () => {
    expect(parseMetaWebhook(payload([textMessage('a', 'oi'), { id: 'b', from: '55', type: 'audio' }]))).toEqual([
      { id: 'a', line: LINE, from: '5511977776666', text: 'oi' },
      { id: 'b', line: LINE, from: '55', text: null },
    ])
  })

  it('ignora entrega, leitura e reação', () => {
    expect(parseMetaWebhook({ entry: [{ changes: [{ field: 'messages', value: { metadata: { phone_number_id: LINE }, statuses: [{}] } }] }] })).toEqual([])
    expect(parseMetaWebhook(payload([{ id: 'c', from: '55', type: 'reaction' }]))).toEqual([])
    expect(parseMetaWebhook(null)).toEqual([])
  })
})

describe('telefone do WhatsApp', () => {
  it('devolve o 9 ao celular antigo e mantém o fixo', () => {
    expect(phoneFromWhatsApp('551188887777')).toBe('5511988887777')
    expect(phoneFromWhatsApp('5511988887777')).toBe('5511988887777')
    expect(phoneFromWhatsApp('551133334444')).toBe('551133334444')
    expect(phoneFromWhatsApp('14155550100')).toBeNull()
  })
})

describe('caixa de entrada', () => {
  it('responde pelo número que escreveu, no negócio da linha', async () => {
    await inbox(answers('Oi! Qual é o seu nome?')).receive(incoming('m1', 'oi', '551188887777'))
    expect(sent).toEqual([{ phone: '551188887777', text: 'Oi! Qual é o seu nome?' }])
    const conversation = db.prepare('SELECT return_client_id, contact FROM assistant_conversations').get() as { return_client_id: string; contact: string }
    expect(conversation).toEqual({ return_client_id: businessId, contact: 'whatsapp:5511988887777' })
  })

  it('não responde duas vezes à mesma mensagem', async () => {
    const box = inbox(answers('Olá, Qual é o seu nome?'))
    await box.receive(incoming('m1', 'oi'))
    await box.receive(incoming('m1', 'oi'))
    expect(sent).toHaveLength(1)
  })

  it('junta o que chega enquanto ela ainda pensa', async () => {
    const seen: string[] = []
    let release = () => {}
    const gate = new Promise<void>((resolve) => (release = resolve))
    const chat: ChatModel = async (messages) => {
      seen.push(messages.at(-1)!.content)
      await gate
      return { content: 'Qual é o seu nome?', toolCalls: [] }
    }
    const box = inbox(chat)
    const first = box.receive(incoming('m1', 'oi'))
    await box.receive(incoming('m2', 'quero um corte'))
    await box.receive(incoming('m3', 'amanhã'))
    release()
    await first
    expect(seen).toEqual(['oi', 'quero um corte\namanhã'])
    expect(sent).toHaveLength(2)
  })

  it('pede texto quando chega áudio, sem chamar a IA', async () => {
    await inbox(async () => { throw new Error('não deveria chamar') }).receive(incoming('m1', null))
    expect(sent[0].text).toContain('texto')
  })

  it('avisa quando a IA está fora do ar', async () => {
    await inbox(async () => { throw new AiUnavailable() }).receive(incoming('m1', 'oi'))
    expect(sent[0].text).toContain('alguns minutos')
  })

  it('não atende linha desconhecida nem negócio pausado', async () => {
    const box = inbox(answers('oi'))
    await box.receive({ ...incoming('m1', 'oi'), line: 'outra' })
    db.prepare(`UPDATE return_clients SET status = 'pausado' WHERE id = ?`).run(businessId)
    await box.receive(incoming('m2', 'oi'))
    expect(sent).toEqual([])
  })

  it('cadastra o número novo só com o nome que a pessoa disse', async () => {
    const box = inbox(answers('Certo, Qual é o seu nome?'))
    await box.receive(incoming('m1', 'oi'))
    await box.receive(incoming('m2', 'Marcos'))
    expect(loadState(db, businessId).customers.find(({ phone }) => phone === '5511977776666')?.name).toBe('Marcos')
  })
})

describe('endereço do webhook', () => {
  const sign = (body: string) => `sha256=${createHmac('sha256', SECRET).update(body).digest('hex')}`
  const webhook = () => whatsappWebhook(inbox(answers('Qual é o seu nome?')), { verifyToken: 'palavra', appSecret: SECRET })
  const post = (body: string, signature?: string) =>
    webhook().request('/webhooks/whatsapp', { method: 'POST', body, headers: signature ? { 'x-hub-signature-256': signature } : {} })

  it('faz a verificação da Meta só com a palavra certa', async () => {
    const good = await webhook().request('/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=palavra&hub.challenge=123')
    const bad = await webhook().request('/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=outra&hub.challenge=123')
    expect([good.status, await good.text(), bad.status]).toEqual([200, '123', 403])
  })

  it('recusa aviso sem a assinatura da Meta', async () => {
    const body = JSON.stringify(payload([textMessage('m1', 'oi')]))
    expect((await post(body)).status).toBe(401)
    expect((await post(body, sign('outro corpo'))).status).toBe(401)
    expect(sent).toEqual([])
  })

  it('aceita aviso assinado e responde na hora', async () => {
    const body = JSON.stringify(payload([textMessage('m1', 'oi')]))
    expect((await post(body, sign(body))).status).toBe(200)
    await expect.poll(() => sent.length).toBe(1)
  })

  it('confere a assinatura com tamanho errado sem quebrar', () => {
    expect(isSignedByMeta('x', 'curta', SECRET)).toBe(false)
  })
})
