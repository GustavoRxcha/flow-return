/**
 * Conector de envio. As telas ainda só preparam a mensagem para uma pessoa enviar.
 * A atendente responde pela API oficial, que é outro SendChannel.
 */
export interface OutgoingMessage {
  phone: string
  text: string
}

export type SendResult = { kind: 'open-url'; url: string } | { kind: 'sent' }

export interface SendChannel {
  id: string
  send(message: OutgoingMessage): Promise<SendResult>
}

export const assistedChannel: SendChannel = {
  id: 'assistido',
  async send({ phone, text }) {
    return { kind: 'open-url', url: `https://wa.me/${phone}?text=${encodeURIComponent(text)}` }
  },
}

const GRAPH_URL = 'https://graph.facebook.com/v27.0'

export class SendFailed extends Error {}

/** API oficial da Meta. O número de testes e o número real usam este mesmo envio. */
export function metaChannel(phoneNumberId: string, accessToken: string): SendChannel {
  return {
    id: 'meta',
    async send({ phone, text }) {
      const response = await fetch(`${GRAPH_URL}/${phoneNumberId}/messages`, {
        method: 'POST',
        headers: { authorization: `Bearer ${accessToken}`, 'content-type': 'application/json' },
        body: JSON.stringify({ messaging_product: 'whatsapp', recipient_type: 'individual', to: phone, type: 'text', text: { body: text } }),
      })
      if (response.ok) return { kind: 'sent' }
      const failure = (await response.json().catch(() => null)) as { error?: { code?: number } } | null
      // Só o código: a mensagem de erro da Meta pode trazer o telefone.
      throw new SendFailed(`Envio recusado pela Meta. Código ${failure?.error?.code ?? response.status}.`)
    },
  }
}

export const activeChannel: SendChannel = assistedChannel
