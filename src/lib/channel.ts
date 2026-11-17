/**
 * Conector de envio. As telas ainda só preparam a mensagem para uma pessoa enviar.
 * A atendente responde pela API oficial, que é outro SendChannel.
 */
export interface OutgoingMessage {
  phone: string
  text: string
  /** Até 3 botões de resposta rápida. A Meta corta o título em 20 letras. */
  buttons?: Array<{ id: string; title: string }>
  /**
   * Modelo aprovado na Meta. Fora da janela de 24 horas, é o único jeito de a empresa escrever primeiro,
   * como nos avisos para o dono. Os parâmetros preenchem {{1}}, {{2}}... e não podem ter quebra de linha.
   */
  template?: { name: string; language: string; parameters: string[] }
}

/** Botões que acompanham um pedido de confirmação. O toque chega como texto que o sim já reconhece. */
export const CONFIRM_BUTTONS = [
  { id: 'confirmar', title: 'Confirmar' },
  { id: 'outro', title: 'Outro horário' },
]

/** Corpo da mensagem para a API da Meta: texto simples ou texto com botões. */
export function metaBody({ phone, text, buttons, template }: OutgoingMessage) {
  const base = { messaging_product: 'whatsapp', recipient_type: 'individual', to: phone }
  if (template) {
    return {
      ...base,
      type: 'template',
      template: {
        name: template.name,
        language: { code: template.language },
        components: [{ type: 'body', parameters: template.parameters.map((value) => ({ type: 'text', text: value })) }],
      },
    }
  }
  if (!buttons?.length) return { ...base, type: 'text', text: { body: text } }
  return {
    ...base,
    type: 'interactive',
    interactive: {
      type: 'button',
      body: { text },
      action: { buttons: buttons.slice(0, 3).map(({ id, title }) => ({ type: 'reply', reply: { id, title: title.slice(0, 20) } })) },
    },
  }
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
    async send(message) {
      const response = await fetch(`${GRAPH_URL}/${phoneNumberId}/messages`, {
        method: 'POST',
        headers: { authorization: `Bearer ${accessToken}`, 'content-type': 'application/json' },
        body: JSON.stringify(metaBody(message)),
      })
      if (response.ok) return { kind: 'sent' }
      const failure = (await response.json().catch(() => null)) as { error?: { code?: number } } | null
      // Só o código: a mensagem de erro da Meta pode trazer o telefone.
      throw new SendFailed(`Envio recusado pela Meta. Código ${failure?.error?.code ?? response.status}.`)
    },
  }
}

export const activeChannel: SendChannel = assistedChannel
