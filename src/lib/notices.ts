/**
 * Avisos que a atendente manda para o dono quando a agenda muda pelo WhatsApp.
 * O texto é curto, deixa duas linhas em branco e termina com o link do painel.
 */

export type OwnerEventKind = 'marcado' | 'desmarcado' | 'remarcado'

export interface OwnerEvent {
  kind: OwnerEventKind
  /** Quem marcou, como está no cadastro. */
  customerName: string
  /** Serviço, dia, hora e profissional, como saiu na confirmação. */
  summary: string
}

const TITLES: Record<OwnerEventKind, string> = {
  marcado: 'Novo agendamento',
  desmarcado: 'Horário desmarcado',
  remarcado: 'Horário remarcado',
}

/** A linha principal do aviso. Sem quebra de linha: é o que vai no parâmetro do modelo da Meta. */
export function ownerNoticeLine({ kind, customerName, summary }: OwnerEvent): string {
  return `${TITLES[kind]}: ${customerName}. ${summary}.`.replace(/\s+/g, ' ').replace(/\.\./g, '.')
}

/** O aviso inteiro, para mandar como texto. Sem link do painel, termina na linha principal. */
export function ownerNoticeText(event: OwnerEvent, panelUrl?: string): string {
  const line = ownerNoticeLine(event)
  return panelUrl ? `${line}\n\n\nVer no painel: ${panelUrl}` : line
}
