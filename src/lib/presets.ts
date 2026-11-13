export interface MessagePreset {
  label: string
  text: string
  /** Só faz sentido para quem já tem horário marcado. */
  needsNextVisit?: boolean
}

export const MESSAGE_PRESETS: MessagePreset[] = [
  {
    label: 'Lembrete para marcar',
    text: 'Oi, {nome}! Aqui é da equipe {negocio}. Faz {tempo} desde o seu último atendimento. Quer marcar o próximo?',
  },
  {
    label: 'Lembrete de horário',
    text: 'Oi, {nome}! Aqui é da equipe {negocio}. Passando para lembrar do seu horário: {proximo}. Podemos confirmar?',
    needsNextVisit: true,
  },
  {
    label: 'Aviso',
    text: 'Oi, {nome}! Aqui é da equipe {negocio}. Temos um aviso para você: ',
  },
]
