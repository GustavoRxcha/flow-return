import { formatDate } from './dates'
import { renderMessage } from './message'
import type { Appointment, EndCustomer, Settings } from './types'

export interface RosterRow {
  customer: EndCustomer
  lastVisit: string
  next: Appointment | null
}

export type NextFilter = 'todos' | 'sem' | 'com'

export const ROSTER_SORTS = {
  'ultimo-antigo': 'Último atendimento: mais antigo',
  'ultimo-recente': 'Último atendimento: mais recente',
  'proximo-perto': 'Próximo atendimento: mais perto',
  'proximo-longe': 'Próximo atendimento: mais longe',
  'nome-az': 'Nome: A a Z',
  'nome-za': 'Nome: Z a A',
  'telefone-menor': 'Telefone: menor para maior',
  'telefone-maior': 'Telefone: maior para menor',
} as const

export type RosterSort = keyof typeof ROSTER_SORTS

export interface RosterFilters {
  search: string
  next: NextFilter
  sort: RosterSort
}

/** Até 15 dias, recente. Até 30, atenção. Depois disso, distante. */
export function absenceTone(days: number): 'recente' | 'atencao' | 'distante' {
  if (days <= 15) return 'recente'
  return days <= 30 ? 'atencao' : 'distante'
}

function normalize(text: string): string {
  return text.normalize('NFD').replace(/\p{M}/gu, '').trim().toLowerCase()
}

/** Liga a agenda à lista pelo nome, porque nem todo horário tem telefone. */
export function buildRoster(customers: EndCustomer[], appointments: Appointment[], today: string): RosterRow[] {
  const byName = new Map<string, Appointment[]>()
  for (const item of appointments) {
    const key = normalize(item.customerName)
    byName.set(key, [...(byName.get(key) ?? []), item])
  }
  return customers.map((customer) => {
    const own = byName.get(normalize(customer.name)) ?? []
    const upcoming = own.filter((item) => item.date >= today).sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`))
    const lastVisit = own.reduce(
      (latest, item) => (item.date < today && item.date > latest ? item.date : latest),
      customer.lastVisit,
    )
    return { customer, lastVisit, next: upcoming[0] ?? null }
  })
}

/** Texto final para uma pessoa, com o último atendimento mostrado na tabela. */
export function messageFor(row: RosterRow, settings: Settings, template: string, today: string): string {
  const next = row.next ? `${formatDate(row.next.date)} às ${row.next.time}` : ''
  return renderMessage({ ...row.customer, lastVisit: row.lastVisit }, { ...settings, template }, today, next)
}

function byNext(a: RosterRow, b: RosterRow, direction: number): number {
  if (!a.next || !b.next) return Number(!a.next) - Number(!b.next)
  return direction * `${a.next.date}${a.next.time}`.localeCompare(`${b.next.date}${b.next.time}`)
}

const COMPARE: Record<RosterSort, (a: RosterRow, b: RosterRow) => number> = {
  'ultimo-antigo': (a, b) => a.lastVisit.localeCompare(b.lastVisit),
  'ultimo-recente': (a, b) => b.lastVisit.localeCompare(a.lastVisit),
  'proximo-perto': (a, b) => byNext(a, b, 1),
  'proximo-longe': (a, b) => byNext(a, b, -1),
  'nome-az': (a, b) => a.customer.name.localeCompare(b.customer.name, 'pt-BR'),
  'nome-za': (a, b) => b.customer.name.localeCompare(a.customer.name, 'pt-BR'),
  'telefone-menor': (a, b) => a.customer.phone.localeCompare(b.customer.phone),
  'telefone-maior': (a, b) => b.customer.phone.localeCompare(a.customer.phone),
}

export function filterRoster(rows: RosterRow[], { search, next, sort }: RosterFilters): RosterRow[] {
  const text = normalize(search)
  const digits = search.replace(/\D/g, '')
  return rows
    .filter((row) => {
      if (next === 'sem' && row.next) return false
      if (next === 'com' && !row.next) return false
      if (!text) return true
      return normalize(row.customer.name).includes(text) || (digits !== '' && row.customer.phone.includes(digits))
    })
    .sort(COMPARE[sort])
}
