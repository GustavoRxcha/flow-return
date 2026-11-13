import { EMPTY_BUSINESS_INFO, type BusinessInfo } from './businessInfo'

export type EndCustomerStatus = 'novo' | 'chamado' | 'voltou' | 'nao_chamar'

export interface EndCustomer {
  /** Telefone normalizado: identifica o cliente em todas as importações. */
  phone: string
  name: string
  /** Data no formato AAAA-MM-DD. */
  lastVisit: string
  service?: string
  status: EndCustomerStatus
  contactedAt?: string
  returnedAt?: string
  /** Só existe quando alguém informou o valor. Nunca é estimado. */
  returnedValue?: number
  snoozedUntil?: string
}

export interface Settings {
  businessName: string
  inactiveDays: number
  dailyLimit: number
  template: string
}

export interface AppState {
  customers: EndCustomer[]
  settings: Settings
  /** Conta de teste: o envio não abre o WhatsApp. */
  demo: boolean
}

export const DEFAULT_TEMPLATE =
  'Oi, {nome}! Aqui é da equipe {negocio}. Faz {tempo} desde a sua última visita. Quer que eu veja um horário para você esta semana? Se preferir não receber mensagens, é só me avisar.'

export const DEFAULT_SETTINGS: Settings = {
  businessName: '',
  inactiveDays: 60,
  dailyLimit: 20,
  template: DEFAULT_TEMPLATE,
}

/** Configuração da atendente de cada negócio. O dia da semana vai de 0 (domingo) a 6 (sábado). */
export interface AssistantSettings {
  name: string
  /** Número que a atendente usa no WhatsApp, normalizado. */
  phone: string | null
  openDays: number[]
  opensAt: string
  closesAt: string
  reactivationEnabled: boolean
  /** O que o negócio ensina à atendente, sempre em campos fixos. */
  info: BusinessInfo
}

export const DEFAULT_ASSISTANT: AssistantSettings = {
  name: '',
  phone: null,
  openDays: [1, 2, 3, 4, 5, 6],
  opensAt: '09:00',
  closesAt: '19:00',
  reactivationEnabled: false,
  info: EMPTY_BUSINESS_INFO,
}

export type UserRole = 'gestor' | 'cliente_return'
export type PlanId = 'basico' | 'medio' | 'avancado'
export type AccountStatus = 'ativo' | 'pausado'

export interface SessionUser {
  id: string
  name: string
  email: string
  role: UserRole
}

/** Cliente Return: o negócio que usa a Flow Return. */
export interface ReturnClient {
  id: string
  name: string
  segment: string
  plan: PlanId
  status: AccountStatus
  demo: boolean
}

export const APPOINTMENT_DURATIONS = [10, 15, 20, 30, 40, 45, 60, 90, 120] as const

/** Quem atende no negócio. O Cliente Return cadastra em Ajustes. */
export interface Professional {
  id: string
  name: string
}

/** O que o negócio oferece. A duração preenche o horário quando o serviço é escolhido. */
export interface Service {
  id: string
  name: string
  durationMinutes: number
  /** Em centavos. Null em serviço sem valor informado. */
  priceCents: number | null
}

export type ServiceInput = Omit<Service, 'id'>

/** Horário na agenda de um profissional do Cliente Return. */
export interface Appointment {
  id: string
  professionalId: string
  professionalName: string
  customerName: string
  service: string
  date: string
  time: string
  durationMinutes: number
  /** Em centavos. Fica guardado no horário: mudar o serviço depois não altera o passado. */
  priceCents: number | null
}

export type AppointmentInput = Omit<Appointment, 'id' | 'professionalName'>
