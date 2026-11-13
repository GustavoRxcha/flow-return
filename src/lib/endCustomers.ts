import { addDays, daysBetween } from './dates'
import type { ParsedEndCustomer } from './table'
import type { AppState, EndCustomer, Settings } from './types'

/** Clientes prontos para chamar. Quem sumiu há menos tempo vem primeiro: é quem mais tende a voltar. */
export function buildQueue(customers: EndCustomer[], settings: Settings, today: string): EndCustomer[] {
  return customers
    .filter(
      (customer) =>
        customer.status === 'novo' &&
        daysBetween(customer.lastVisit, today) >= settings.inactiveDays &&
        (!customer.snoozedUntil || customer.snoozedUntil <= today),
    )
    .sort((a, b) => b.lastVisit.localeCompare(a.lastVisit))
}

/**
 * Junta uma nova lista à atual sem perder histórico. Quem pediu para não ser chamado
 * continua bloqueado, e quem foi chamado e tem visita nova passa a contar como retorno.
 */
export function mergeImport(current: EndCustomer[], incoming: ParsedEndCustomer[]): EndCustomer[] {
  const byPhone = new Map(current.map((customer) => [customer.phone, customer]))

  for (const parsed of incoming) {
    const existing = byPhone.get(parsed.phone)
    if (!existing) {
      byPhone.set(parsed.phone, { ...parsed, status: 'novo' })
      continue
    }
    const lastVisit = parsed.lastVisit > existing.lastVisit ? parsed.lastVisit : existing.lastVisit
    const merged: EndCustomer = {
      ...existing,
      name: parsed.name,
      service: parsed.service ?? existing.service,
      lastVisit,
    }
    const cameBack =
      existing.status === 'chamado' && existing.contactedAt && parsed.lastVisit > existing.contactedAt
    if (cameBack) {
      merged.status = 'voltou'
      merged.returnedAt = parsed.lastVisit
    }
    byPhone.set(parsed.phone, merged)
  }

  return [...byPhone.values()]
}

export interface Metrics {
  inQueue: number
  waiting: number
  contacted: number
  returned: number
  recoveredValue: number
  returnRate: number
  sentToday: number
  leftToday: number
  blocked: number
}

export function computeMetrics(state: AppState, today: string): Metrics {
  const { customers, settings } = state
  const returned = customers.filter((customer) => customer.status === 'voltou')
  const waiting = customers.filter((customer) => customer.status === 'chamado').length
  const contacted = waiting + returned.filter((customer) => customer.contactedAt).length
  const sentToday = customers.filter((customer) => customer.contactedAt === today).length

  return {
    inQueue: buildQueue(customers, settings, today).length,
    waiting,
    contacted,
    returned: returned.length,
    recoveredValue: returned.reduce((sum, customer) => sum + (customer.returnedValue ?? 0), 0),
    returnRate: contacted === 0 ? 0 : returned.length / contacted,
    sentToday,
    leftToday: Math.max(settings.dailyLimit - sentToday, 0),
    blocked: customers.filter((customer) => customer.status === 'nao_chamar').length,
  }
}

export function snoozeUntil(today: string): string {
  return addDays(today, 7)
}
