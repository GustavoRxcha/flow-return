export interface MessagePreset {
  /** Nome do botão, traduzido por `preset.<key>`. O texto da mensagem vai ao cliente e fica em português. */
  key: 'book' | 'appointment' | 'notice'
  label: string
  text: string
  /** Só faz sentido para quem já tem horário marcado. */
  needsNextVisit?: boolean
}

export const MESSAGE_PRESETS: MessagePreset[] = [
  {
    key: 'book',
    label: 'Lembrete para marcar',
    text: 'Oi, {nome}! Aqui é da equipe {negocio}. Faz {tempo} desde o seu último atendimento. Quer marcar o próximo?',
  },
  {
    key: 'appointment',
    label: 'Lembrete de horário',
    text: 'Oi, {nome}! Aqui é da equipe {negocio}. Passando para lembrar do seu horário: {proximo}. Podemos confirmar?',
    needsNextVisit: true,
  },
  {
    key: 'notice',
    label: 'Aviso',
    text: 'Oi, {nome}! Aqui é da equipe {negocio}. Temos um aviso para você: ',
  },
]
