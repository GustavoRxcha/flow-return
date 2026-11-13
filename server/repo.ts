import { randomBytes, randomUUID } from 'node:crypto'
import type { Db } from './db.ts'
import { findConflict } from '../src/lib/agenda.ts'
import { DEFAULT_SETTINGS } from '../src/lib/types.ts'
import type { AccountStatus, Appointment, AppointmentInput, AppState, EndCustomer, PlanId, Professional, ReturnClient, Service, ServiceInput } from '../src/lib/types.ts'

interface ReturnClientRow {
  id: string
  name: string
  segment: string
  plan: PlanId
  status: AccountStatus
  demo: number
  inactive_days: number
  daily_limit: number
  template: string
}

interface EndCustomerRow {
  phone: string
  name: string
  last_visit: string
  service: string | null
  status: EndCustomer['status']
  contacted_at: string | null
  returned_at: string | null
  returned_value: number | null
  snoozed_until: string | null
}

function getRow(db: Db, id: string): ReturnClientRow | undefined {
  return db.prepare('SELECT * FROM return_clients WHERE id = ?').get(id) as ReturnClientRow | undefined
}

export function getReturnClient(db: Db, id: string): ReturnClient | null {
  const row = getRow(db, id)
  if (!row) return null
  return {
    id: row.id,
    name: row.name,
    segment: row.segment,
    plan: row.plan,
    status: row.status,
    demo: row.demo === 1,
  }
}

export function loadState(db: Db, returnClientId: string): AppState {
  const row = getRow(db, returnClientId)
  if (!row) throw new Error('Cliente Return não encontrado')
  const rows = db
    .prepare('SELECT * FROM end_customers WHERE return_client_id = ?')
    .all(returnClientId) as unknown as EndCustomerRow[]

  return {
    demo: row.demo === 1,
    settings: {
      ...DEFAULT_SETTINGS,
      businessName: row.name,
      inactiveDays: row.inactive_days,
      dailyLimit: row.daily_limit,
      template: row.template,
    },
    customers: rows.map((item) => ({
      phone: item.phone,
      name: item.name,
      lastVisit: item.last_visit,
      service: item.service ?? undefined,
      status: item.status,
      contactedAt: item.contacted_at ?? undefined,
      returnedAt: item.returned_at ?? undefined,
      returnedValue: item.returned_value ?? undefined,
      snoozedUntil: item.snoozed_until ?? undefined,
    })),
  }
}

export function saveState(db: Db, returnClientId: string, state: AppState): void {
  db.exec('BEGIN')
  try {
    db.prepare('UPDATE return_clients SET name = ?, inactive_days = ?, daily_limit = ?, template = ? WHERE id = ?').run(
      state.settings.businessName,
      state.settings.inactiveDays,
      state.settings.dailyLimit,
      state.settings.template,
      returnClientId,
    )
    db.prepare('DELETE FROM end_customers WHERE return_client_id = ?').run(returnClientId)
    const insert = db.prepare(
      `INSERT INTO end_customers
       (return_client_id, phone, name, last_visit, service, status, contacted_at, returned_at, returned_value, snoozed_until)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    for (const customer of state.customers) {
      insert.run(
        returnClientId,
        customer.phone,
        customer.name,
        customer.lastVisit,
        customer.service ?? null,
        customer.status,
        customer.contactedAt ?? null,
        customer.returnedAt ?? null,
        customer.returnedValue ?? null,
        customer.snoozedUntil ?? null,
      )
    }
    db.exec('COMMIT')
  } catch (error) {
    db.exec('ROLLBACK')
    throw error
  }
}

interface ProfessionalRow {
  id: string
  name: string
}

export function listProfessionals(db: Db, returnClientId: string): Professional[] {
  return db
    .prepare('SELECT id, name FROM professionals WHERE return_client_id = ? AND active = 1 ORDER BY created_at, name')
    .all(returnClientId) as unknown as ProfessionalRow[]
}

export type ProfessionalFailure = 'nao_encontrado' | 'nome_em_uso' | 'ultimo_profissional' | 'tem_horarios'

function nameTaken(db: Db, returnClientId: string, name: string, ignoreId?: string): boolean {
  const key = name.toLocaleLowerCase('pt-BR')
  return listProfessionals(db, returnClientId).some(
    (item) => item.id !== ignoreId && item.name.toLocaleLowerCase('pt-BR') === key,
  )
}

export function createProfessional(db: Db, returnClientId: string, name: string): ProfessionalFailure | 'ok' {
  if (nameTaken(db, returnClientId, name)) return 'nome_em_uso'
  db.prepare('INSERT INTO professionals (id, return_client_id, name, created_at) VALUES (?, ?, ?, ?)').run(
    randomUUID(),
    returnClientId,
    name,
    new Date().toISOString(),
  )
  return 'ok'
}

export function renameProfessional(db: Db, returnClientId: string, id: string, name: string): ProfessionalFailure | 'ok' {
  if (!listProfessionals(db, returnClientId).some((item) => item.id === id)) return 'nao_encontrado'
  if (nameTaken(db, returnClientId, name, id)) return 'nome_em_uso'
  db.prepare('UPDATE professionals SET name = ? WHERE id = ? AND return_client_id = ?').run(name, id, returnClientId)
  return 'ok'
}

/** Sai da lista, mas continua no histórico dos horários que já passaram. */
export function removeProfessional(db: Db, returnClientId: string, id: string, today: string): ProfessionalFailure | 'ok' {
  const professionals = listProfessionals(db, returnClientId)
  if (!professionals.some((item) => item.id === id)) return 'nao_encontrado'
  if (professionals.length === 1) return 'ultimo_profissional'
  const booked = db
    .prepare('SELECT 1 FROM appointments WHERE professional_id = ? AND return_client_id = ? AND date >= ? LIMIT 1')
    .get(id, returnClientId, today)
  if (booked) return 'tem_horarios'
  db.prepare('UPDATE professionals SET active = 0 WHERE id = ? AND return_client_id = ?').run(id, returnClientId)
  return 'ok'
}

interface ServiceRow {
  id: string
  name: string
  duration_minutes: number
  price_cents: number | null
}

export function listServices(db: Db, returnClientId: string): Service[] {
  const rows = db
    .prepare('SELECT id, name, duration_minutes, price_cents FROM services WHERE return_client_id = ? ORDER BY created_at, name')
    .all(returnClientId) as unknown as ServiceRow[]
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    durationMinutes: row.duration_minutes,
    priceCents: row.price_cents,
  }))
}

export type ServiceResult = 'ok' | 'nao_encontrado' | 'nome_em_uso'

function serviceNameTaken(db: Db, returnClientId: string, name: string, ignoreId?: string): boolean {
  const key = name.toLocaleLowerCase('pt-BR')
  return listServices(db, returnClientId).some(
    (item) => item.id !== ignoreId && item.name.toLocaleLowerCase('pt-BR') === key,
  )
}

/** Horários que ainda não têm valor recebem o valor do serviço de mesmo nome. */
function fillMissingPrices(db: Db, returnClientId: string, { name, priceCents }: ServiceInput): void {
  if (priceCents === null) return
  db.prepare(
    `UPDATE appointments SET price_cents = ?
     WHERE return_client_id = ? AND price_cents IS NULL AND service = ? COLLATE NOCASE`,
  ).run(priceCents, returnClientId, name)
}

export function createService(db: Db, returnClientId: string, input: ServiceInput): ServiceResult {
  if (serviceNameTaken(db, returnClientId, input.name)) return 'nome_em_uso'
  db.prepare(
    'INSERT INTO services (id, return_client_id, name, duration_minutes, price_cents, created_at) VALUES (?, ?, ?, ?, ?, ?)',
  ).run(randomUUID(), returnClientId, input.name, input.durationMinutes, input.priceCents, new Date().toISOString())
  fillMissingPrices(db, returnClientId, input)
  return 'ok'
}

export function updateService(db: Db, returnClientId: string, id: string, input: ServiceInput): ServiceResult {
  if (!listServices(db, returnClientId).some((item) => item.id === id)) return 'nao_encontrado'
  if (serviceNameTaken(db, returnClientId, input.name, id)) return 'nome_em_uso'
  db.prepare('UPDATE services SET name = ?, duration_minutes = ?, price_cents = ? WHERE id = ? AND return_client_id = ?').run(
    input.name,
    input.durationMinutes,
    input.priceCents,
    id,
    returnClientId,
  )
  fillMissingPrices(db, returnClientId, input)
  return 'ok'
}

/** Os horários guardam o nome do serviço, então a agenda não muda quando ele sai da lista. */
export function deleteService(db: Db, returnClientId: string, id: string): boolean {
  return db.prepare('DELETE FROM services WHERE id = ? AND return_client_id = ?').run(id, returnClientId).changes > 0
}

interface AppointmentRow {
  id: string
  professional_id: string
  professional_name: string
  customer_name: string
  service: string
  date: string
  time: string
  duration_minutes: number
  price_cents: number | null
}

function toAppointments(rows: AppointmentRow[]): Appointment[] {
  return rows.map((row) => ({
    id: row.id,
    professionalId: row.professional_id,
    professionalName: row.professional_name,
    customerName: row.customer_name,
    service: row.service,
    date: row.date,
    time: row.time,
    durationMinutes: row.duration_minutes,
    priceCents: row.price_cents,
  }))
}

export function listAppointments(db: Db, returnClientId: string): Appointment[] {
  const rows = db
    .prepare(
      `SELECT a.*, p.name AS professional_name FROM appointments a
       JOIN professionals p ON p.id = a.professional_id
       WHERE a.return_client_id = ? ORDER BY a.date, a.time`,
    )
    .all(returnClientId) as unknown as AppointmentRow[]
  return toAppointments(rows)
}

/** Só os horários deste número. A conversa do cliente nunca enxerga os de outra pessoa. */
export function listOwnAppointments(db: Db, returnClientId: string, phone: string): Appointment[] {
  const rows = db
    .prepare(
      `SELECT a.*, p.name AS professional_name FROM appointments a
       JOIN professionals p ON p.id = a.professional_id
       WHERE a.return_client_id = ? AND a.customer_phone = ? ORDER BY a.date, a.time`,
    )
    .all(returnClientId, phone) as unknown as AppointmentRow[]
  return toAppointments(rows)
}

/** Telefone de quem tem esse nome na lista. Com nome repetido, fica sem dono. */
function phoneForName(db: Db, returnClientId: string, name: string): string | null {
  const rows = db
    .prepare('SELECT phone FROM end_customers WHERE return_client_id = ? AND lower(name) = lower(?)')
    .all(returnClientId, name.trim()) as unknown as Array<{ phone: string }>
  return rows.length === 1 ? rows[0].phone : null
}

export type AppointmentFailure = 'horario_ocupado' | 'profissional_invalido'

function isListed(db: Db, returnClientId: string, professionalId: string): boolean {
  return listProfessionals(db, returnClientId).some((item) => item.id === professionalId)
}

/**
 * Único caminho para criar horário. O agendamento do cliente final também deve passar por aqui.
 * Cada profissional tem a própria agenda: o período só fica ocupado para quem já atende nele.
 */
export function createAppointment(
  db: Db,
  returnClientId: string,
  input: AppointmentInput & { customerPhone?: string },
): { id: string } | { error: AppointmentFailure } {
  if (!isListed(db, returnClientId, input.professionalId)) return { error: 'profissional_invalido' }
  if (findConflict(listAppointments(db, returnClientId), input)) return { error: 'horario_ocupado' }
  const id = randomUUID()
  db.prepare(
    `INSERT INTO appointments (id, return_client_id, professional_id, customer_name, customer_phone, service, date, time, duration_minutes, price_cents)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    returnClientId,
    input.professionalId,
    input.customerName,
    input.customerPhone ?? phoneForName(db, returnClientId, input.customerName),
    input.service,
    input.date,
    input.time,
    input.durationMinutes,
    input.priceCents,
  )
  return { id }
}

export type UpdateResult = 'ok' | 'nao_encontrado' | AppointmentFailure

export function updateAppointment(db: Db, returnClientId: string, id: string, input: AppointmentInput): UpdateResult {
  const appointments = listAppointments(db, returnClientId)
  const current = appointments.find((item) => item.id === id)
  if (!current) return 'nao_encontrado'
  if (current.professionalId !== input.professionalId && !isListed(db, returnClientId, input.professionalId)) {
    return 'profissional_invalido'
  }
  if (findConflict(appointments, input, id)) return 'horario_ocupado'
  // Outro nome é outra pessoa: o dono do horário muda junto.
  const newOwner = current.customerName === input.customerName ? null : phoneForName(db, returnClientId, input.customerName)
  db
    .prepare(
      `UPDATE appointments SET professional_id = ?, customer_name = ?, service = ?, date = ?, time = ?, duration_minutes = ?, price_cents = ?,
       customer_phone = CASE WHEN ? THEN ? ELSE customer_phone END
       WHERE id = ? AND return_client_id = ?`,
    )
    .run(
      input.professionalId,
      input.customerName,
      input.service,
      input.date,
      input.time,
      input.durationMinutes,
      input.priceCents,
      current.customerName === input.customerName ? 0 : 1,
      newOwner,
      id,
      returnClientId,
    )
  return 'ok'
}

/** Desmarca só se o horário for deste número. A trava está na própria consulta ao banco. */
export function deleteOwnAppointment(db: Db, returnClientId: string, phone: string, id: string): boolean {
  const result = db
    .prepare('DELETE FROM appointments WHERE id = ? AND return_client_id = ? AND customer_phone = ?')
    .run(id, returnClientId, phone)
  return result.changes > 0
}

/** Remarca só se o horário for deste número. Serviço, duração e valor continuam os mesmos. */
export function moveOwnAppointment(
  db: Db,
  returnClientId: string,
  phone: string,
  id: string,
  { date, time, professionalId }: Pick<Appointment, 'date' | 'time' | 'professionalId'>,
): UpdateResult {
  const current = listOwnAppointments(db, returnClientId, phone).find((item) => item.id === id)
  if (!current) return 'nao_encontrado'
  if (!isListed(db, returnClientId, professionalId)) return 'profissional_invalido'
  if (findConflict(listAppointments(db, returnClientId), { ...current, date, time, professionalId }, id)) return 'horario_ocupado'
  db.prepare(
    `UPDATE appointments SET date = ?, time = ?, professional_id = ?
     WHERE id = ? AND return_client_id = ? AND customer_phone = ?`,
  ).run(date, time, professionalId, id, returnClientId, phone)
  return 'ok'
}

export function deleteAppointment(db: Db, returnClientId: string, id: string): boolean {
  const result = db.prepare('DELETE FROM appointments WHERE id = ? AND return_client_id = ?').run(id, returnClientId)
  return result.changes > 0
}

export function getCalendarToken(db: Db, returnClientId: string): string | null {
  const row = db.prepare('SELECT token FROM calendar_links WHERE return_client_id = ?').get(returnClientId) as
    | { token: string }
    | undefined
  return row?.token ?? null
}

export function ensureCalendarToken(db: Db, returnClientId: string): string {
  const existing = getCalendarToken(db, returnClientId)
  if (existing) return existing
  const token = randomBytes(32).toString('hex')
  db.prepare('INSERT INTO calendar_links (return_client_id, token) VALUES (?, ?)').run(returnClientId, token)
  return token
}

export function deleteCalendarToken(db: Db, returnClientId: string): void {
  db.prepare('DELETE FROM calendar_links WHERE return_client_id = ?').run(returnClientId)
}

export function findReturnClientByCalendarToken(db: Db, token: string): ReturnClient | null {
  const row = db.prepare('SELECT return_client_id AS id FROM calendar_links WHERE token = ?').get(token) as
    | { id: string }
    | undefined
  return row ? getReturnClient(db, row.id) : null
}
