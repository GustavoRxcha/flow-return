import { addDays } from './dates'
import type { Appointment, AppointmentInput, Professional } from './types'

function pad(value: number): string {
  return String(value).padStart(2, '0')
}

/** Fim do horário. Pode cair no dia seguinte. */
export function appointmentEnd({ date, time, durationMinutes }: Pick<Appointment, 'date' | 'time' | 'durationMinutes'>): { date: string; time: string } {
  const [hours, minutes] = time.split(':').map(Number)
  const total = hours * 60 + minutes + durationMinutes
  return {
    date: addDays(date, Math.floor(total / 1440)),
    time: `${pad(Math.floor(total / 60) % 24)}:${pad(total % 60)}`,
  }
}

function startMinute({ date, time }: Pick<Appointment, 'date' | 'time'>): number {
  const [year, month, day] = date.split('-').map(Number)
  const [hours, minutes] = time.split(':').map(Number)
  return Date.UTC(year, month - 1, day) / 60_000 + hours * 60 + minutes
}

/** Primeiro horário do mesmo profissional no mesmo período. Um pode começar quando o outro termina. */
export function findConflict(
  appointments: Appointment[],
  input: AppointmentInput,
  ignoreId?: string,
): Appointment | null {
  const start = startMinute(input)
  const end = start + input.durationMinutes
  return (
    appointments.find((item) => {
      if (item.id === ignoreId || item.professionalId !== input.professionalId) return false
      const itemStart = startMinute(item)
      return start < itemStart + item.durationMinutes && itemStart < end
    }) ?? null
  )
}

/** Quem ainda pode atender nesse período. Sem ninguém livre, o horário está esgotado. */
export function freeProfessionals<T extends Pick<Professional, 'id'>>(
  professionals: T[],
  appointments: Appointment[],
  slot: Omit<AppointmentInput, 'professionalId'>,
  ignoreId?: string,
): T[] {
  return professionals.filter(({ id }) => !findConflict(appointments, { ...slot, professionalId: id }, ignoreId))
}

export function dayLabel(date: string, today: string): string {
  if (date === today) return 'Hoje'
  if (date === addDays(today, 1)) return 'Amanhã'
  const [year, month, day] = date.split('-').map(Number)
  const weekday = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', timeZone: 'UTC' }).format(
    new Date(Date.UTC(year, month - 1, day)),
  )
  return `${weekday[0].toUpperCase()}${weekday.slice(1)}, ${pad(day)}/${pad(month)}`
}

const DEFAULT_FIRST_HOUR = 7
const DEFAULT_LAST_HOUR = 21

function parts(date: string): [number, number, number] {
  const [year, month, day] = date.split('-').map(Number)
  return [year, month, day]
}

function isoOf(year: number, month: number, day: number): string {
  return `${year}-${pad(month)}-${pad(day)}`
}

export function weekdayOf(date: string): number {
  const [year, month, day] = parts(date)
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay()
}

export function monthLabel(date: string): string {
  const [year, month] = parts(date)
  const name = new Intl.DateTimeFormat('pt-BR', { month: 'long', timeZone: 'UTC' }).format(
    new Date(Date.UTC(year, month - 1, 1)),
  )
  return `${name[0].toUpperCase()}${name.slice(1)} ${year}`
}

/** Semanas do mês, de domingo a sábado. Dias de fora ficam como null. */
export function monthWeeks(date: string): Array<Array<string | null>> {
  const [year, month] = parts(date)
  const total = new Date(Date.UTC(year, month, 0)).getUTCDate()
  const cells: Array<string | null> = Array(weekdayOf(isoOf(year, month, 1))).fill(null)
  for (let day = 1; day <= total; day++) cells.push(isoOf(year, month, day))
  while (cells.length % 7 !== 0) cells.push(null)
  return Array.from({ length: cells.length / 7 }, (_, week) => cells.slice(week * 7, week * 7 + 7))
}

export function weekDays(date: string): string[] {
  const sunday = addDays(date, -weekdayOf(date))
  return Array.from({ length: 7 }, (_, index) => addDays(sunday, index))
}

/** Dia escolhido ao trocar de mês: hoje, se for o mês atual, ou o dia 1. */
export function shiftMonth(date: string, amount: number, today: string): string {
  const [year, month] = parts(date)
  const target = new Date(Date.UTC(year, month - 1 + amount, 1))
  const first = isoOf(target.getUTCFullYear(), target.getUTCMonth() + 1, 1)
  return first.slice(0, 7) === today.slice(0, 7) ? today : first
}

export function minutesOf(time: string): number {
  const [hours, minutes] = time.split(':').map(Number)
  return hours * 60 + minutes
}

/** Faixa de horas do dia. Cresce para caber todos os horários. */
export function dayHours(items: Appointment[]): { first: number; last: number } {
  let first = DEFAULT_FIRST_HOUR
  let last = DEFAULT_LAST_HOUR
  for (const item of items) {
    const start = minutesOf(item.time)
    first = Math.min(first, Math.floor(start / 60))
    last = Math.max(last, Math.min(24, Math.ceil((start + item.durationMinutes) / 60)))
  }
  return { first, last }
}

export interface PlacedAppointment {
  item: Appointment
  /** Horas a partir do topo da grade. */
  start: number
  length: number
  column: number
  columns: number
}

/** Posiciona os horários do dia. Quem se sobrepõe divide a largura. */
export function layoutDay(items: Appointment[], firstHour: number, lastHour: number): PlacedAppointment[] {
  const sorted = [...items].sort((a, b) => a.time.localeCompare(b.time))
  const placed: PlacedAppointment[] = []
  let cluster: PlacedAppointment[] = []
  let columnEnds: number[] = []
  let clusterEnd = 0

  const closeCluster = () => {
    for (const entry of cluster) entry.columns = columnEnds.length
    cluster = []
    columnEnds = []
  }

  for (const item of sorted) {
    const start = minutesOf(item.time)
    const end = Math.min(start + item.durationMinutes, lastHour * 60)
    if (start >= clusterEnd) closeCluster()
    let column = columnEnds.findIndex((columnEnd) => columnEnd <= start)
    if (column === -1) column = columnEnds.length
    columnEnds[column] = end
    clusterEnd = Math.max(clusterEnd, end)
    const entry = { item, start: start / 60 - firstHour, length: (end - start) / 60, column, columns: 1 }
    cluster.push(entry)
    placed.push(entry)
  }
  closeCluster()
  return placed
}

export function calendarLinks(host: string, token: string): { ios: string; google: string } {
  const webcal = `webcal://${host}/api/calendar/${token}.ics`
  return {
    ios: webcal,
    google: `https://calendar.google.com/calendar/render?cid=${encodeURIComponent(webcal)}`,
  }
}
