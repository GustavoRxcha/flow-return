import { Hono, type Context, type Next } from 'hono'
import { deleteCookie, getCookie, setCookie } from 'hono/cookie'
import {
  createSession,
  deleteSession,
  findSessionUser,
  generatePassword,
  hashPassword,
  newId,
  verifyPassword,
  type AuthUser,
} from './auth.ts'
import { AiUnavailable, type ChatModel } from './ai.ts'
import { assistantTurn, clearConversation, getAssistant, MAX_ASSISTANT_TEXT, saveAssistant } from './assistant.ts'
import type { Db } from './db.ts'
import { buildIcs } from './ics.ts'
import {
  createAppointment,
  createProfessional,
  createService,
  deleteAppointment,
  deleteCalendarToken,
  deleteService,
  ensureCalendarToken,
  findReturnClientByCalendarToken,
  getCalendarToken,
  getReturnClient,
  listAppointments,
  listProfessionals,
  listServices,
  loadState,
  removeProfessional,
  renameProfessional,
  saveState,
  updateAppointment,
  updateService,
  type ProfessionalFailure,
  type ServiceResult,
} from './repo.ts'
import { addDays, parseDate, todayIso } from '../src/lib/dates.ts'
import { PAYMENT_METHODS, YES_NO_QUESTIONS, type BusinessInfo, type PaymentMethod, type YesNo, type YesNoKey } from '../src/lib/businessInfo.ts'
import { normalizeBrPhone } from '../src/lib/phone.ts'
import { computeMetrics } from '../src/lib/endCustomers.ts'
import { reducer, type Action } from '../src/lib/reducer.ts'
import { parseEndCustomerTable } from '../src/lib/table.ts'
import { APPOINTMENT_DURATIONS, DEFAULT_SETTINGS } from '../src/lib/types.ts'
import type { AccountStatus, AppointmentInput, AssistantSettings, PlanId, ReturnClient, ServiceInput, Settings } from '../src/lib/types.ts'

const COOKIE = 'fr_session'
const MAX_ATTEMPTS = 8
const ATTEMPT_WINDOW_MS = 10 * 60_000
const MAX_IMPORT_CHARS = 2_000_000
const PLAN_IDS: PlanId[] = ['basico', 'medio', 'avancado']
const STATUSES: AccountStatus[] = ['ativo', 'pausado']
const FEED_HISTORY_DAYS = 90
const MAX_PROFESSIONAL_NAME = 120
const MAX_SERVICE_NAME = 120
const MAX_PRICE_CENTS = 100_000_000

type Env = { Variables: { user: AuthUser } }

function isInt(value: unknown, min: number, max: number): value is number {
  return Number.isInteger(value) && (value as number) >= min && (value as number) <= max
}

function cleanSettings(input: unknown): Partial<Settings> | null {
  if (typeof input !== 'object' || input === null) return null
  const { businessName, inactiveDays, dailyLimit, template } = input as Partial<Settings>
  const settings: Partial<Settings> = {}
  if (businessName !== undefined) {
    if (typeof businessName !== 'string' || !businessName.trim() || businessName.length > 120) return null
    settings.businessName = businessName
  }
  if (inactiveDays !== undefined) {
    if (!isInt(inactiveDays, 1, 3650)) return null
    settings.inactiveDays = inactiveDays
  }
  if (dailyLimit !== undefined) {
    if (!isInt(dailyLimit, 1, 200)) return null
    settings.dailyLimit = dailyLimit
  }
  if (template !== undefined) {
    if (typeof template !== 'string' || !template.trim() || template.length > 1000) return null
    settings.template = template
  }
  return settings
}

/** Devolve undefined se o valor for inválido. Sem valor informado, devolve null. */
function cleanPrice(value: unknown): number | null | undefined {
  if (value === undefined || value === null) return null
  return isInt(value, 0, MAX_PRICE_CENTS) ? value : undefined
}

function cleanAppointment(input: unknown): AppointmentInput | null {
  if (typeof input !== 'object' || input === null) return null
  const { professionalId, customerName, service, date, time, durationMinutes, priceCents } = input as Record<string, unknown>
  const price = cleanPrice(priceCents)
  if (price === undefined) return null
  if (typeof professionalId !== 'string' || !professionalId) return null
  if (typeof customerName !== 'string' || !customerName.trim() || customerName.length > 120) return null
  if (typeof service !== 'string' || !service.trim() || service.length > 120) return null
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date) || parseDate(date) !== date) return null
  if (typeof time !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) return null
  if (!APPOINTMENT_DURATIONS.some((minutes) => minutes === durationMinutes)) return null
  return {
    professionalId,
    customerName: customerName.trim(),
    service: service.trim(),
    date,
    time,
    durationMinutes: durationMinutes as number,
    priceCents: price,
  }
}

const CLOCK = /^([01]\d|2[0-3]):[0-5]\d$/
const MAX_ASSISTANT_NAME = 40
const MAX_ADDRESS = 160
const MAX_REFERENCE = 120
const TEST_CONTACT = 'teste'

/** Uma linha só: o texto do negócio entra nas informações da IA sem mudar a estrutura delas. */
function oneLine(text: string): string {
  return text.replace(/\s+/g, ' ').trim()
}

function cleanBusinessInfo(input: unknown): BusinessInfo | null {
  if (typeof input !== 'object' || input === null) return null
  const { address, reference, payments, ...answers } = input as Record<string, unknown>
  if (typeof address !== 'string' || oneLine(address).length > MAX_ADDRESS) return null
  if (typeof reference !== 'string' || oneLine(reference).length > MAX_REFERENCE) return null
  if (!Array.isArray(payments) || !payments.every((item) => PAYMENT_METHODS.some(({ id }) => id === item))) return null
  if (!YES_NO_QUESTIONS.every(({ key }) => answers[key] === null || typeof answers[key] === 'boolean')) return null
  const yesNo = (key: YesNoKey) => answers[key] as YesNo
  return {
    address: oneLine(address),
    reference: oneLine(reference),
    parking: yesNo('parking'),
    walkIn: yesNo('walkIn'),
    accessibility: yesNo('accessibility'),
    children: yesNo('children'),
    payments: [...new Set(payments as PaymentMethod[])],
  }
}

function cleanAssistant(input: unknown): AssistantSettings | 'telefone_invalido' | null {
  if (typeof input !== 'object' || input === null) return null
  const { name, phone, openDays, opensAt, closesAt, reactivationEnabled } = input as Record<string, unknown>
  const info = cleanBusinessInfo((input as Record<string, unknown>).info)
  if (typeof name !== 'string' || name.trim().length > MAX_ASSISTANT_NAME) return null
  if (!info) return null
  if (typeof phone !== 'string' || typeof reactivationEnabled !== 'boolean') return null
  if (typeof opensAt !== 'string' || typeof closesAt !== 'string') return null
  if (!CLOCK.test(opensAt) || !CLOCK.test(closesAt) || opensAt >= closesAt) return null
  if (!Array.isArray(openDays) || !openDays.length || !openDays.every((day) => isInt(day, 0, 6))) return null
  const normalized = phone.trim() ? normalizeBrPhone(phone) : null
  if (phone.trim() && !normalized) return 'telefone_invalido'
  return {
    name: name.trim(),
    phone: normalized,
    openDays: [...new Set(openDays as number[])].sort(),
    opensAt,
    closesAt,
    reactivationEnabled,
    info,
  }
}

function cleanProfessionalName(input: unknown): string | null {
  const name = (input as { name?: unknown } | null)?.name
  if (typeof name !== 'string' || !name.trim() || name.trim().length > MAX_PROFESSIONAL_NAME) return null
  return name.trim()
}

function cleanService(input: unknown): ServiceInput | null {
  const { name, durationMinutes, priceCents } = (input ?? {}) as Record<string, unknown>
  const price = cleanPrice(priceCents)
  if (price === undefined) return null
  if (typeof name !== 'string' || !name.trim() || name.trim().length > MAX_SERVICE_NAME) return null
  if (!APPOINTMENT_DURATIONS.some((minutes) => minutes === durationMinutes)) return null
  return { name: name.trim(), durationMinutes: durationMinutes as number, priceCents: price }
}

/** Só estas ações vêm do navegador. A data é sempre a do servidor. */
function cleanAction(input: unknown, today: string): Action | null {
  if (typeof input !== 'object' || input === null) return null
  const { type, phone, value, settings } = input as Record<string, unknown>
  if (type === 'settings') {
    const clean = cleanSettings(settings)
    return clean && { type, settings: clean }
  }
  if (typeof phone !== 'string') return null
  switch (type) {
    case 'markSent':
    case 'skip':
      return { type, phone, today }
    case 'block':
    case 'backToQueue':
      return { type, phone }
    case 'markReturned':
      if (value !== undefined && (typeof value !== 'number' || !Number.isFinite(value) || value < 0)) return null
      return { type, phone, today, value: value as number | undefined }
    default:
      return null
  }
}

export function createApp(db: Db, options: { secureCookies?: boolean; chat?: ChatModel } = {}) {
  const app = new Hono<Env>().basePath('/api')
  const attempts = new Map<string, { count: number; firstAt: number }>()

  function publicUser(user: AuthUser) {
    return { id: user.id, name: user.name, email: user.email, role: user.role }
  }

  async function requireUser(c: Context<Env>, next: Next) {
    const token = getCookie(c, COOKIE)
    const user = token ? findSessionUser(db, token) : null
    if (!user) return c.json({ error: 'nao_autenticado' }, 401)
    c.set('user', user)
    await next()
  }

  async function requireGestor(c: Context<Env>, next: Next) {
    if (c.get('user').role !== 'gestor') return c.json({ error: 'sem_permissao' }, 403)
    await next()
  }

  async function requireReturnClient(c: Context<Env>, next: Next) {
    const { role, returnClientId } = c.get('user')
    if (role !== 'cliente_return' || !returnClientId) return c.json({ error: 'sem_permissao' }, 403)
    if (getReturnClient(db, returnClientId)?.status !== 'ativo') return c.json({ error: 'conta_pausada' }, 403)
    await next()
  }

  function workspace(returnClientId: string) {
    const today = todayIso()
    return { state: loadState(db, returnClientId), today }
  }

  app.post('/login', async (c) => {
    const body = await c.req.json().catch(() => null)
    const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : ''
    const password = typeof body?.password === 'string' ? body.password : ''

    const now = Date.now()
    const entry = attempts.get(email)
    if (entry && now - entry.firstAt < ATTEMPT_WINDOW_MS && entry.count >= MAX_ATTEMPTS) {
      return c.json({ error: 'muitas_tentativas' }, 429)
    }

    const row = db.prepare('SELECT id, password_hash FROM users WHERE email = ?').get(email) as
      | { id: string; password_hash: string }
      | undefined
    if (!row || !verifyPassword(password, row.password_hash)) {
      const fresh = !entry || now - entry.firstAt >= ATTEMPT_WINDOW_MS
      attempts.set(email, fresh ? { count: 1, firstAt: now } : { ...entry, count: entry.count + 1 })
      return c.json({ error: 'login_invalido' }, 401)
    }

    attempts.delete(email)
    db.prepare('UPDATE users SET last_login_at = ? WHERE id = ?').run(new Date().toISOString(), row.id)
    setCookie(c, COOKIE, createSession(db, row.id), {
      httpOnly: true,
      sameSite: 'Lax',
      secure: options.secureCookies ?? false,
      path: '/',
      maxAge: 14 * 86_400,
    })
    return c.json({ ok: true })
  })

  app.post('/logout', (c) => {
    const token = getCookie(c, COOKIE)
    if (token) deleteSession(db, token)
    deleteCookie(c, COOKIE, { path: '/' })
    return c.json({ ok: true })
  })

  app.use('/me', requireUser)
  app.get('/me', (c) => {
    const user = c.get('user')
    const returnClient: ReturnClient | null = user.returnClientId ? getReturnClient(db, user.returnClientId) : null
    return c.json({ user: publicUser(user), returnClient })
  })

  // Área do Cliente Return. O negócio sempre vem da sessão, nunca do navegador.
  app.use('/workspace/*', requireUser, requireReturnClient)
  app.use('/workspace', requireUser, requireReturnClient)

  app.get('/workspace', (c) => c.json(workspace(c.get('user').returnClientId!)))

  app.post('/workspace/actions', async (c) => {
    const returnClientId = c.get('user').returnClientId!
    const { state, today } = workspace(returnClientId)
    const action = cleanAction(await c.req.json().catch(() => null), today)
    if (!action) return c.json({ error: 'acao_invalida' }, 400)
    if ('phone' in action && !state.customers.some((customer) => customer.phone === action.phone)) {
      return c.json({ error: 'nao_encontrado' }, 404)
    }
    const next = reducer(state, action)
    saveState(db, returnClientId, next)
    return c.json({ state: next, today })
  })

  app.post('/workspace/import', async (c) => {
    const returnClientId = c.get('user').returnClientId!
    const body = await c.req.json().catch(() => null)
    if (typeof body?.text !== 'string' || body.text.length > MAX_IMPORT_CHARS) {
      return c.json({ error: 'lista_invalida' }, 400)
    }
    const { state, today } = workspace(returnClientId)
    const { customers, issues, missingColumns } = parseEndCustomerTable(body.text, today)
    if (missingColumns.length > 0) return c.json({ error: 'colunas_faltando', missingColumns }, 400)
    const next = reducer(state, { type: 'import', customers })
    saveState(db, returnClientId, next)
    return c.json({ state: next, today, imported: customers.length, ignored: issues.length })
  })

  function agenda(returnClientId: string) {
    return {
      appointments: listAppointments(db, returnClientId),
      professionals: listProfessionals(db, returnClientId),
      services: listServices(db, returnClientId),
      calendarToken: getCalendarToken(db, returnClientId),
      today: todayIso(),
    }
  }

  app.get('/workspace/agenda', (c) => c.json(agenda(c.get('user').returnClientId!)))

  app.post('/workspace/agenda', async (c) => {
    const returnClientId = c.get('user').returnClientId!
    const input = cleanAppointment(await c.req.json().catch(() => null))
    if (!input) return c.json({ error: 'dados_invalidos' }, 400)
    const result = createAppointment(db, returnClientId, input)
    if ('error' in result) return c.json(result, result.error === 'horario_ocupado' ? 409 : 400)
    return c.json(agenda(returnClientId), 201)
  })

  app.post('/workspace/agenda/link', (c) => {
    const returnClientId = c.get('user').returnClientId!
    ensureCalendarToken(db, returnClientId)
    return c.json(agenda(returnClientId))
  })

  app.delete('/workspace/agenda/link', (c) => {
    const returnClientId = c.get('user').returnClientId!
    deleteCalendarToken(db, returnClientId)
    return c.json(agenda(returnClientId))
  })

  app.put('/workspace/agenda/:id', async (c) => {
    const returnClientId = c.get('user').returnClientId!
    const input = cleanAppointment(await c.req.json().catch(() => null))
    if (!input) return c.json({ error: 'dados_invalidos' }, 400)
    const result = updateAppointment(db, returnClientId, c.req.param('id'), input)
    if (result === 'nao_encontrado') return c.json({ error: result }, 404)
    if (result === 'horario_ocupado') return c.json({ error: result }, 409)
    if (result === 'profissional_invalido') return c.json({ error: result }, 400)
    return c.json(agenda(returnClientId))
  })

  app.delete('/workspace/agenda/:id', (c) => {
    const returnClientId = c.get('user').returnClientId!
    if (!deleteAppointment(db, returnClientId, c.req.param('id'))) return c.json({ error: 'nao_encontrado' }, 404)
    return c.json(agenda(returnClientId))
  })

  function professionalsReply(c: Context<Env>, returnClientId: string, result: ProfessionalFailure | 'ok', status: 200 | 201 = 200) {
    if (result === 'nao_encontrado') return c.json({ error: result }, 404)
    if (result !== 'ok') return c.json({ error: result }, 409)
    return c.json({ professionals: listProfessionals(db, returnClientId) }, status)
  }

  app.get('/workspace/professionals', (c) => {
    const returnClientId = c.get('user').returnClientId!
    return professionalsReply(c, returnClientId, 'ok')
  })

  app.post('/workspace/professionals', async (c) => {
    const returnClientId = c.get('user').returnClientId!
    const name = cleanProfessionalName(await c.req.json().catch(() => null))
    if (!name) return c.json({ error: 'dados_invalidos' }, 400)
    return professionalsReply(c, returnClientId, createProfessional(db, returnClientId, name), 201)
  })

  app.put('/workspace/professionals/:id', async (c) => {
    const returnClientId = c.get('user').returnClientId!
    const name = cleanProfessionalName(await c.req.json().catch(() => null))
    if (!name) return c.json({ error: 'dados_invalidos' }, 400)
    return professionalsReply(c, returnClientId, renameProfessional(db, returnClientId, c.req.param('id'), name))
  })

  app.delete('/workspace/professionals/:id', (c) => {
    const returnClientId = c.get('user').returnClientId!
    return professionalsReply(c, returnClientId, removeProfessional(db, returnClientId, c.req.param('id'), todayIso()))
  })

  function servicesReply(c: Context<Env>, returnClientId: string, result: ServiceResult, status: 200 | 201 = 200) {
    if (result === 'nao_encontrado') return c.json({ error: result }, 404)
    if (result === 'nome_em_uso') return c.json({ error: result }, 409)
    return c.json({ services: listServices(db, returnClientId) }, status)
  }

  app.get('/workspace/services', (c) => servicesReply(c, c.get('user').returnClientId!, 'ok'))

  app.post('/workspace/services', async (c) => {
    const returnClientId = c.get('user').returnClientId!
    const input = cleanService(await c.req.json().catch(() => null))
    if (!input) return c.json({ error: 'dados_invalidos' }, 400)
    return servicesReply(c, returnClientId, createService(db, returnClientId, input), 201)
  })

  app.put('/workspace/services/:id', async (c) => {
    const returnClientId = c.get('user').returnClientId!
    const input = cleanService(await c.req.json().catch(() => null))
    if (!input) return c.json({ error: 'dados_invalidos' }, 400)
    return servicesReply(c, returnClientId, updateService(db, returnClientId, c.req.param('id'), input))
  })

  app.delete('/workspace/services/:id', (c) => {
    const returnClientId = c.get('user').returnClientId!
    const removed = deleteService(db, returnClientId, c.req.param('id'))
    return servicesReply(c, returnClientId, removed ? 'ok' : 'nao_encontrado')
  })

  app.get('/workspace/assistant', (c) => c.json({ assistant: getAssistant(db, c.get('user').returnClientId!) }))

  app.put('/workspace/assistant', async (c) => {
    const returnClientId = c.get('user').returnClientId!
    const input = cleanAssistant(await c.req.json().catch(() => null))
    if (input === 'telefone_invalido') return c.json({ error: input }, 400)
    if (!input) return c.json({ error: 'dados_invalidos' }, 400)
    saveAssistant(db, returnClientId, input)
    return c.json({ assistant: getAssistant(db, returnClientId) })
  })

  app.post('/workspace/assistant/test', async (c) => {
    const returnClientId = c.get('user').returnClientId!
    const body = (await c.req.json().catch(() => null)) as { text?: unknown; phone?: unknown } | null
    const text = typeof body?.text === 'string' ? body.text.trim() : ''
    if (!text || text.length > MAX_ASSISTANT_TEXT) return c.json({ error: 'dados_invalidos' }, 400)
    // O teste vale de verdade: o que ela marcar entra na agenda, preso a este número.
    const phone = typeof body?.phone === 'string' ? normalizeBrPhone(body.phone) : null
    if (!phone) return c.json({ error: 'telefone_invalido' }, 400)
    try {
      const result = await assistantTurn(db, returnClientId, `${TEST_CONTACT}:${phone}`, text, { phone, chat: options.chat })
      return c.json(result)
    } catch (failure) {
      if (failure instanceof AiUnavailable) return c.json({ error: 'ia_desligada' }, 503)
      throw failure
    }
  })

  app.delete('/workspace/assistant/test', (c) => {
    const phone = normalizeBrPhone(c.req.query('phone') ?? '')
    if (phone) clearConversation(db, c.get('user').returnClientId!, `${TEST_CONTACT}:${phone}`)
    return c.json({ ok: true })
  })

  // Link privado lido pelo Google e pelo iPhone. O código secreto substitui o login.
  app.get('/calendar/:file', (c) => {
    const token = c.req.param('file').replace(/\.ics$/, '')
    const returnClient = findReturnClientByCalendarToken(db, token)
    if (returnClient?.status !== 'ativo') return c.json({ error: 'nao_encontrado' }, 404)
    const firstDay = addDays(todayIso(), -FEED_HISTORY_DAYS)
    const appointments = listAppointments(db, returnClient.id).filter((item) => item.date >= firstDay)
    c.header('Content-Type', 'text/calendar; charset=utf-8')
    c.header('Cache-Control', 'private, max-age=300')
    return c.body(buildIcs(appointments, returnClient.name, new Date()))
  })

  // Área do gestor. Devolve só números: nomes e telefones de clientes finais não saem daqui.
  app.use('/admin/*', requireUser, requireGestor)

  app.get('/admin/overview', (c) => {
    const today = todayIso()
    const rows = db
      .prepare(
        `SELECT r.id, u.name AS ownerName, u.email AS ownerEmail, u.last_login_at AS lastLoginAt
         FROM return_clients r LEFT JOIN users u ON u.return_client_id = r.id
         ORDER BY r.created_at`,
      )
      .all() as unknown as Array<{ id: string; ownerName: string | null; ownerEmail: string | null; lastLoginAt: string | null }>

    const clients = rows.map((row) => {
      const state = loadState(db, row.id)
      const metrics = computeMetrics(state, today)
      return {
        ...getReturnClient(db, row.id)!,
        ownerName: row.ownerName,
        ownerEmail: row.ownerEmail,
        lastLoginAt: row.lastLoginAt,
        inactiveDays: state.settings.inactiveDays,
        dailyLimit: state.settings.dailyLimit,
        endCustomers: state.customers.length,
        inQueue: metrics.inQueue,
        contacted: metrics.contacted,
        returned: metrics.returned,
        recoveredValue: metrics.recoveredValue,
      }
    })

    return c.json({
      clients,
      totals: {
        returnClients: clients.length,
        active: clients.filter((client) => client.status === 'ativo').length,
        endCustomers: clients.reduce((sum, client) => sum + client.endCustomers, 0),
        returned: clients.reduce((sum, client) => sum + client.returned, 0),
        recoveredValue: clients.reduce((sum, client) => sum + client.recoveredValue, 0),
      },
    })
  })

  app.post('/admin/clients', async (c) => {
    const body = await c.req.json().catch(() => null)
    const name = typeof body?.name === 'string' ? body.name.trim() : ''
    const segment = typeof body?.segment === 'string' ? body.segment.trim() : ''
    const ownerName = typeof body?.ownerName === 'string' ? body.ownerName.trim() : ''
    const ownerEmail = typeof body?.ownerEmail === 'string' ? body.ownerEmail.trim().toLowerCase() : ''
    const plan = PLAN_IDS.includes(body?.plan) ? (body.plan as PlanId) : 'basico'
    if (!name || !segment || !ownerName || !/^\S+@\S+\.\S+$/.test(ownerEmail)) {
      return c.json({ error: 'dados_invalidos' }, 400)
    }
    if (db.prepare('SELECT 1 FROM users WHERE email = ?').get(ownerEmail)) {
      return c.json({ error: 'email_em_uso' }, 409)
    }

    const id = newId()
    const password = generatePassword()
    db.prepare(
      `INSERT INTO return_clients (id, name, segment, plan, status, demo, inactive_days, daily_limit, template, created_at)
       VALUES (?, ?, ?, ?, 'ativo', 0, ?, ?, ?, ?)`,
    ).run(id, name, segment, plan, DEFAULT_SETTINGS.inactiveDays, DEFAULT_SETTINGS.dailyLimit, DEFAULT_SETTINGS.template, new Date().toISOString())
    db.prepare(
      `INSERT INTO users (id, email, name, password_hash, role, return_client_id) VALUES (?, ?, ?, ?, 'cliente_return', ?)`,
    ).run(newId(), ownerEmail, ownerName, hashPassword(password), id)
    createProfessional(db, id, ownerName)
    return c.json({ id, temporaryPassword: password }, 201)
  })

  app.patch('/admin/clients/:id', async (c) => {
    const id = c.req.param('id')
    if (!getReturnClient(db, id)) return c.json({ error: 'nao_encontrado' }, 404)
    const body = await c.req.json().catch(() => null)
    const { plan, status, inactiveDays, dailyLimit } = body ?? {}
    if (plan !== undefined && !PLAN_IDS.includes(plan)) return c.json({ error: 'dados_invalidos' }, 400)
    if (status !== undefined && !STATUSES.includes(status)) return c.json({ error: 'dados_invalidos' }, 400)
    if (inactiveDays !== undefined && !isInt(inactiveDays, 1, 3650)) return c.json({ error: 'dados_invalidos' }, 400)
    if (dailyLimit !== undefined && !isInt(dailyLimit, 1, 200)) return c.json({ error: 'dados_invalidos' }, 400)

    db.prepare(
      `UPDATE return_clients SET
         plan = COALESCE(?, plan), status = COALESCE(?, status),
         inactive_days = COALESCE(?, inactive_days), daily_limit = COALESCE(?, daily_limit)
       WHERE id = ?`,
    ).run(plan ?? null, status ?? null, inactiveDays ?? null, dailyLimit ?? null, id)
    return c.json({ ok: true })
  })

  app.post('/admin/clients/:id/reset-password', (c) => {
    const id = c.req.param('id')
    const user = db.prepare('SELECT id FROM users WHERE return_client_id = ?').get(id) as { id: string } | undefined
    if (!user) return c.json({ error: 'nao_encontrado' }, 404)
    const password = generatePassword()
    db.exec('BEGIN')
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hashPassword(password), user.id)
    db.prepare('DELETE FROM sessions WHERE user_id = ?').run(user.id)
    db.exec('COMMIT')
    return c.json({ temporaryPassword: password })
  })

  return app
}
