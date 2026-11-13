import { appointmentEnd } from './agenda'
import type { Appointment, Professional } from './types'

export interface ProfessionalShare {
  id: string
  name: string
  attended: number
  cents: number
}

export interface MonthFinance {
  receivedCents: number
  expectedCents: number
  /** Null enquanto nenhum atendimento com valor terminou no mês. */
  averageCents: number | null
  /** Horários do mês sem valor. Ficam fora das contas, porque valor nunca é estimado. */
  withoutPrice: number
  byProfessional: ProfessionalShare[]
  topServices: Array<{ name: string; count: number }>
}

const MAX_TOP_SERVICES = 5

function hasEnded(item: Appointment, now: { date: string; time: string }): boolean {
  const end = appointmentEnd(item)
  return `${end.date} ${end.time}` <= `${now.date} ${now.time}`
}

/** Conta como recebido o horário que já terminou. O que ainda não terminou vai entrar. */
export function monthFinance(
  appointments: Appointment[],
  professionals: Professional[],
  month: string,
  now: { date: string; time: string },
): MonthFinance {
  const items = appointments.filter((item) => item.date.startsWith(month))
  const shares = new Map<string, ProfessionalShare>(
    professionals.map(({ id, name }) => [id, { id, name, attended: 0, cents: 0 }]),
  )
  const services = new Map<string, { name: string; count: number }>()
  let receivedCents = 0
  let expectedCents = 0
  let paid = 0

  for (const item of items) {
    const key = item.service.trim().toLocaleLowerCase('pt-BR')
    const service = services.get(key) ?? { name: item.service, count: 0 }
    services.set(key, { ...service, count: service.count + 1 })

    const price = item.priceCents ?? 0
    if (!hasEnded(item, now)) {
      expectedCents += price
      continue
    }
    receivedCents += price
    if (item.priceCents !== null) paid += 1
    const share = shares.get(item.professionalId) ?? {
      id: item.professionalId,
      name: item.professionalName,
      attended: 0,
      cents: 0,
    }
    shares.set(item.professionalId, { ...share, attended: share.attended + 1, cents: share.cents + price })
  }

  return {
    receivedCents,
    expectedCents,
    averageCents: paid > 0 ? Math.round(receivedCents / paid) : null,
    withoutPrice: items.filter((item) => item.priceCents === null).length,
    byProfessional: [...shares.values()].sort((a, b) => b.cents - a.cents || b.attended - a.attended),
    topServices: [...services.values()]
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'pt-BR'))
      .slice(0, MAX_TOP_SERVICES),
  }
}
