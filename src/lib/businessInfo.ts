/** Sim, não ou null, quando o negócio não respondeu. */
export type YesNo = boolean | null

export type PaymentMethod = 'pix' | 'dinheiro' | 'debito' | 'credito'

export interface BusinessInfo {
  address: string
  reference: string
  parking: YesNo
  walkIn: YesNo
  accessibility: YesNo
  children: YesNo
  payments: PaymentMethod[]
}

export const EMPTY_BUSINESS_INFO: BusinessInfo = {
  address: '',
  reference: '',
  parking: null,
  walkIn: null,
  accessibility: null,
  children: null,
  payments: [],
}

export type YesNoKey = 'parking' | 'walkIn' | 'accessibility' | 'children'

/** Cada pergunta da tela, a frase padrão que a IA recebe e as palavras que a trava procura na resposta. */
export const YES_NO_QUESTIONS: Array<{ key: YesNoKey; question: string; topic: string; yes: string; no: string; words: RegExp }> = [
  {
    key: 'parking',
    question: 'Possui estacionamento?',
    topic: 'estacionamento',
    yes: 'Tem estacionamento.',
    no: 'Não tem estacionamento.',
    words: /estacionamento|estacionar/,
  },
  {
    key: 'walkIn',
    question: 'Atende sem horário marcado?',
    topic: 'atendimento sem horário marcado',
    yes: 'Atende sem horário marcado.',
    no: 'Só atende com horário marcado.',
    words: /sem (horario|hora) marcad|so (atende|atendemos) com (horario|hora) marcad|ordem de chegada/,
  },
  {
    key: 'accessibility',
    question: 'Tem acessibilidade para cadeirantes?',
    topic: 'acessibilidade',
    yes: 'Tem acessibilidade para cadeirantes.',
    no: 'Não tem acessibilidade para cadeirantes.',
    words: /acessibilidade|acessivel|cadeirante|cadeira de rodas/,
  },
  {
    key: 'children',
    question: 'Atende crianças?',
    topic: 'atendimento de crianças',
    yes: 'Atende crianças.',
    no: 'Não atende crianças.',
    words: /crianca|infantil/,
  },
]

export const PAYMENT_METHODS: Array<{ id: PaymentMethod; label: string; words: RegExp }> = [
  { id: 'pix', label: 'Pix', words: /\bpix\b/ },
  { id: 'dinheiro', label: 'Dinheiro', words: /\bdinheiro\b/ },
  { id: 'debito', label: 'Cartão de débito', words: /\bdebito\b/ },
  { id: 'credito', label: 'Cartão de crédito', words: /\bcredito\b/ },
]

/** Monta o texto que a IA consulta. Todo negócio sai na mesma estrutura, e o que faltou fica dito. */
export function businessFacts(info: BusinessInfo): string {
  const known: string[] = []
  const missing: string[] = []
  const note = (value: string, label: string) => (value ? known.push(`${label}: ${value}`) : missing.push(label.toLowerCase()))

  note(info.address, 'Endereço')
  if (info.reference) known.push(`Ponto de referência: ${info.reference}`)
  for (const { key, topic, yes, no } of YES_NO_QUESTIONS) {
    if (info[key] === null) missing.push(topic)
    else known.push(info[key] ? yes : no)
  }
  note(PAYMENT_METHODS.filter(({ id }) => info.payments.includes(id)).map(({ label }) => label).join(', '), 'Formas de pagamento')
  const refused = PAYMENT_METHODS.filter(({ id }) => !info.payments.includes(id)).map(({ label }) => label)
  if (info.payments.length && refused.length) known.push(`Não aceita: ${refused.join(', ')}`)

  return [
    'Informações do negócio. Copie estes dados como estão e não complete nada:',
    ...known.map((line) => `- ${line}`),
    ...(missing.length ? [`Sem informação, diga que não tem essa informação: ${missing.join(', ')}.`] : []),
  ].join('\n')
}
