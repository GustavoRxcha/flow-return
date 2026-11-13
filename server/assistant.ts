import { acceptedProposal, asksOwnAppointments, ASSISTANT_TOOLS, availabilityIn, availabilityReply, changeRequest, confirmedBy, confirmsBooking, datesInConversation, findInvented, isYes, listServicesInLines, looksLikeName, lookupTimes, mentionsSomeoneElse, myAppointments, nameFromAnswer, nameIsForSomeoneElse, nameWasSaid, prepareBooking, prepareCancel, prepareMove, readDate, requestToLookUp, stopRequest, systemPrompt, wantsChange, timesIn, type AssistantContext, type Availability, type PendingChange, type ToolArgs } from '../src/lib/assistant.ts'
import { todayIso } from '../src/lib/dates.ts'
import { formatCents } from '../src/lib/format.ts'
import { DEFAULT_ASSISTANT, type AssistantSettings } from '../src/lib/types.ts'
import { ollamaChat, type ChatMessage, type ChatModel } from './ai.ts'
import type { Db } from './db.ts'
import { createAppointment, deleteOwnAppointment, getReturnClient, listAppointments, listOwnAppointments, listProfessionals, listServices, loadState, moveOwnAppointment } from './repo.ts'
import { EMPTY_BUSINESS_INFO, type BusinessInfo } from '../src/lib/businessInfo.ts'

/** Conversa parada há mais tempo que isso recomeça do zero. */
const CONVERSATION_TTL_MS = 6 * 60 * 60 * 1000
/** Mensagens guardadas por conversa. */
const MAX_HISTORY = 40
/** Tentativas da IA em cada mensagem, somando consultas e correções. */
const MAX_ROUNDS = 7
/** A segunda tentativa guarda o contexto da conversa. Depois disso, o sistema responde e a pessoa não espera mais. */
const MAX_RETRIES_WITH_ANSWER = 2
/** Maior mensagem que a atendente lê. */
export const MAX_ASSISTANT_TEXT = 500
const MAX_CUSTOMER_NAME = 80
const ASK_NAME = 'Qual é o seu nome?'
const SAFE_REPLY = 'Desculpe, não consegui conferir isso agora. Pode me dizer de novo o que você precisa?'
const ONLY_OWN_REPLY = 'Só consigo alterar horários marcados neste número. Se o horário for de outra pessoa, ela precisa pedir pelo número dela.'
const STOPPED_REPLY = 'Pronto. Você não vai mais receber mensagens automáticas.'
const STOP_FOR_OTHER_REPLY = 'Esse pedido vale só para quem escreve. Cada pessoa precisa pedir pelo próprio número.'

interface AssistantRow {
  name: string
  phone: string | null
  open_days: string
  opens_at: string
  closes_at: string
  reactivation_enabled: number
  business_info: string
}

export function getAssistant(db: Db, returnClientId: string): AssistantSettings {
  const row = db.prepare('SELECT * FROM assistants WHERE return_client_id = ?').get(returnClientId) as unknown as
    | AssistantRow
    | undefined
  if (!row) return DEFAULT_ASSISTANT
  return {
    name: row.name,
    phone: row.phone,
    openDays: JSON.parse(row.open_days) as number[],
    opensAt: row.opens_at,
    closesAt: row.closes_at,
    reactivationEnabled: row.reactivation_enabled === 1,
    info: { ...EMPTY_BUSINESS_INFO, ...(JSON.parse(row.business_info) as Partial<BusinessInfo>) },
  }
}

export function saveAssistant(db: Db, returnClientId: string, input: AssistantSettings): void {
  db.prepare(
    `INSERT INTO assistants (return_client_id, name, phone, open_days, opens_at, closes_at, reactivation_enabled, business_info)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (return_client_id) DO UPDATE SET
       name = excluded.name, phone = excluded.phone, open_days = excluded.open_days, opens_at = excluded.opens_at,
       closes_at = excluded.closes_at, reactivation_enabled = excluded.reactivation_enabled,
       business_info = excluded.business_info`,
  ).run(
    returnClientId,
    input.name,
    input.phone,
    JSON.stringify(input.openDays),
    input.opensAt,
    input.closesAt,
    input.reactivationEnabled ? 1 : 0,
    JSON.stringify(input.info),
  )
}

interface SavedConversation {
  messages: ChatMessage[]
  customerName: string | null
  booked: boolean
  changed: boolean
  /** Alteração preparada, esperando o sim da pessoa. */
  pending: PendingChange | null
}

const NEW_CONVERSATION: SavedConversation = { messages: [], customerName: null, booked: false, changed: false, pending: null }

function loadConversation(db: Db, returnClientId: string, contact: string): SavedConversation {
  const row = db
    .prepare('SELECT state, updated_at FROM assistant_conversations WHERE return_client_id = ? AND contact = ?')
    .get(returnClientId, contact) as unknown as { state: string; updated_at: number } | undefined
  if (!row || Date.now() - row.updated_at > CONVERSATION_TTL_MS) return NEW_CONVERSATION
  const saved = JSON.parse(row.state) as Partial<SavedConversation>
  return Array.isArray(saved.messages) ? { ...NEW_CONVERSATION, ...saved } : NEW_CONVERSATION
}

function saveConversation(db: Db, returnClientId: string, contact: string, conversation: SavedConversation): void {
  const start = conversation.messages.findIndex(
    ({ role }, index) => role === 'user' && conversation.messages.length - index <= MAX_HISTORY,
  )
  const messages = conversation.messages.slice(Math.max(start, 0))
  db.prepare(
    `INSERT INTO assistant_conversations (return_client_id, contact, state, updated_at) VALUES (?, ?, ?, ?)
     ON CONFLICT (return_client_id, contact) DO UPDATE SET state = excluded.state, updated_at = excluded.updated_at`,
  ).run(returnClientId, contact, JSON.stringify({ ...conversation, messages }), Date.now())
}

export function clearConversation(db: Db, returnClientId: string, contact: string): void {
  db.prepare('DELETE FROM assistant_conversations WHERE return_client_id = ? AND contact = ?').run(returnClientId, contact)
}

function clockNow(now: Date): string {
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
}

export interface TurnOptions {
  /** Telefone de quem escreve: reconhece o cliente e cadastra quem é novo. */
  phone?: string
  now?: Date
  chat?: ChatModel
}

export interface TurnResult {
  reply: string
  booked: boolean
  /** O que ela consultou ou fez no sistema, para acompanhar no teste. */
  trail: string[]
}

/** Recebe uma mensagem e devolve a resposta. O WhatsApp vai chamar esta mesma função. */
export async function assistantTurn(
  db: Db,
  returnClientId: string,
  contact: string,
  text: string,
  { phone, now = new Date(), chat = ollamaChat }: TurnOptions = {},
): Promise<TurnResult> {
  const state = loadState(db, returnClientId)
  const today = todayIso(now)
  const saved = loadConversation(db, returnClientId, contact)
  const knownName = phone ? state.customers.find((customer) => customer.phone === phone)?.name : undefined
  const ctx: AssistantContext = {
    businessName: state.settings.businessName || getReturnClient(db, returnClientId)?.name || '',
    assistant: getAssistant(db, returnClientId),
    services: listServices(db, returnClientId),
    professionals: listProfessionals(db, returnClientId),
    appointments: listAppointments(db, returnClientId),
    ownAppointments: phone ? listOwnAppointments(db, returnClientId, phone) : [],
    today,
    now: clockNow(now),
    customerName: knownName ?? saved.customerName,
  }

  const history: ChatMessage[] = [...saved.messages, { role: 'user', content: text }]
  const trail: string[] = []
  let booked = false
  let changed = false
  const firstName = (name: string) => name.trim().split(/\s+/)[0].toLowerCase()
  // Citar um profissional não é falar de outro cliente, mesmo com o mesmo primeiro nome.
  const staff = new Set(ctx.professionals.map(({ name }) => firstName(name)))
  const otherCustomers = state.customers.filter((customer) => customer.phone !== phone && !staff.has(firstName(customer.name))).map(({ name }) => name)
  const aboutSomeoneElse = mentionsSomeoneElse(text, otherCustomers, ctx.customerName)
  let pending: PendingChange | null = null
  let available: Availability | null = null
  /** Ação já feita: se a IA não conseguir escrever, a pessoa recebe a confirmação mesmo assim. */
  let doneReply: string | null = null
  let stopped = false

  const contents = (role: ChatMessage['role']) => history.filter((item) => item.role === role).map((item) => item.content)

  function saveCustomer(nome: string): void {
    ctx.customerName = nome
    if (phone) {
      db.prepare(
        `INSERT OR IGNORE INTO end_customers (return_client_id, phone, name, last_visit, status) VALUES (?, ?, ?, ?, 'novo')`,
      ).run(returnClientId, phone, nome, today)
    }
    trail.push(`Cliente novo salvo: ${nome}.`)
  }

  // O cadastro não depende da IA lembrar de chamar a ferramenta.
  const lastReply = [...saved.messages].reverse().find(({ role, content }) => role === 'assistant' && content)
  const answeredName = !ctx.customerName && lastReply ? nameFromAnswer(lastReply.content, text) : null
  if (answeredName) saveCustomer(answeredName.slice(0, MAX_CUSTOMER_NAME))

  function refreshAgenda(): void {
    ctx.appointments = listAppointments(db, returnClientId)
    ctx.ownAppointments = phone ? listOwnAppointments(db, returnClientId, phone) : []
  }

  /** Só roda depois do sim, sempre preso ao número de quem escreve. */
  function applyChange(change: PendingChange): unknown {
    const { kind, appointmentId, summary, done: doneText, target } = change
    if (!phone) return { ok: false, erro: 'Não encontrei esse horário neste número.' }
    const done =
      kind === 'desmarcar'
        ? deleteOwnAppointment(db, returnClientId, phone, appointmentId)
        : moveOwnAppointment(db, returnClientId, phone, appointmentId, target!) === 'ok'
    if (!done) return { ok: false, erro: 'Não consegui alterar esse horário. Use ver_meus_horarios e ver_horarios de novo.' }
    refreshAgenda()
    changed = true
    doneReply = doneText
    trail.push(`Feito: ${summary}.`)
    return { ok: true, feito: summary }
  }

  const conversationDates = () => datesInConversation(contents('tool'), contents('user'), today)

  function runTool(name: string, args: ToolArgs): unknown {
    if (name === 'ver_horarios') {
      const result = lookupTimes(args, ctx, conversationDates())
      available = availabilityIn(result)
      trail.push('dia' in result ? `Consultou a agenda: ${result.dia}.` : 'Consultou a agenda.')
      return result
    }
    if (name === 'salvar_cliente') {
      const nome = typeof args.nome === 'string' ? args.nome.trim().slice(0, MAX_CUSTOMER_NAME) : ''
      if (knownName) return { ok: true }
      if (!nameWasSaid(nome, contents('user')) || !looksLikeName(nome)) return { ok: false, erro: 'A pessoa ainda não disse o nome. Pergunte.' }
      if (nameIsForSomeoneElse(nome, contents('user'))) return { ok: false, erro: 'Esse nome é de quem vai ser atendido. Pergunte o nome de quem está escrevendo.' }
      if (ctx.customerName !== nome) saveCustomer(nome)
      return { ok: true }
    }
    if (name === 'marcar_horario') {
      const prepared = prepareBooking(args, ctx, conversationDates())
      if (!('booking' in prepared)) return prepared
      if (!lastReply || !confirmsBooking(lastReply.content, text, prepared.booking.time)) {
        return { ok: false, erro: 'A pessoa ainda não confirmou. Repita serviço, dia, hora e um profissional e pergunte se pode confirmar.' }
      }
      const created = createAppointment(db, returnClientId, { ...prepared.booking, customerPhone: phone })
      if ('error' in created) return { ok: false, erro: 'Esse horário não está livre. Use ver_horarios e ofereça outro.' }
      refreshAgenda()
      booked = true
      available = null
      const { priceCents } = prepared.booking
      doneReply = `Pronto, marquei: ${prepared.summary}.${priceCents === null ? '' : ` Valor: ${formatCents(priceCents)}.`}`
      trail.push(`Marcou: ${prepared.summary}.`)
      return { ok: true, marcado: prepared.summary }
    }
    if (name === 'ver_meus_horarios') {
      trail.push('Consultou os horários deste número.')
      return myAppointments(ctx)
    }
    if (name === 'desmarcar_horario' || name === 'remarcar_horario') {
      // Mudar a hora de um pedido novo não pode mexer em horário que a pessoa já tem.
      if (!contents('user').some(wantsChange) && !wantsChange(lastReply?.content ?? '')) {
        return { ok: false, erro: 'A pessoa não pediu para alterar um horário marcado. Este é um pedido novo: repita serviço, dia, hora e profissional e pergunte se pode confirmar.' }
      }
      const prepared = name === 'desmarcar_horario' ? prepareCancel(args, ctx) : prepareMove(args, ctx, conversationDates())
      if (!('kind' in prepared)) return prepared
      if (lastReply && confirmedBy(lastReply.content, prepared, text)) return applyChange(prepared)
      pending = prepared
      trail.push(`Pediu confirmação: ${prepared.summary}.`)
      return { ok: true, falta_confirmar: true, resumo: prepared.summary }
    }
    if (name === 'parar_mensagens') {
      if (aboutSomeoneElse) {
        return { ok: false, erro: 'Vale só para este número. Diga que cada pessoa precisa pedir pelo próprio número.' }
      }
      if (phone) {
        db.prepare(`UPDATE end_customers SET status = 'nao_chamar' WHERE return_client_id = ? AND phone = ?`).run(returnClientId, phone)
      }
      stopped = true
      doneReply = STOPPED_REPLY
      trail.push('Parou as mensagens automáticas.')
      return { ok: true }
    }
    return { ok: false, erro: 'Essa ferramenta não existe.' }
  }

  // Sim a um resumo completo: quem marca é o sistema. A IA só escreve a confirmação.
  const accepted = lastReply && ctx.customerName && !saved.pending ? acceptedProposal(lastReply.content, text, ctx, contents('user')) : null
  if (saved.pending && isYes(text)) {
    const toolName = saved.pending.kind === 'desmarcar' ? 'desmarcar_horario' : 'remarcar_horario'
    history.push({ role: 'assistant', content: '', tool_calls: [{ function: { name: toolName, arguments: {} } }] })
    history.push({ role: 'tool', tool_name: toolName, content: JSON.stringify(applyChange(saved.pending)) })
  }
  if (accepted) {
    const call = { function: { name: 'marcar_horario', arguments: accepted } }
    history.push({ role: 'assistant', content: '', tool_calls: [call] })
    history.push({ role: 'tool', tool_name: 'marcar_horario', content: JSON.stringify(runTool('marcar_horario', accepted)) })
  }

  const stopping = stopRequest(text)
  if (stopping === 'proprio' && !aboutSomeoneElse) {
    history.push({ role: 'assistant', content: '', tool_calls: [{ function: { name: 'parar_mensagens', arguments: {} } }] })
    history.push({ role: 'tool', tool_name: 'parar_mensagens', content: JSON.stringify(runTool('parar_mensagens', {})) })
  } else if (stopping) {
    stopped = true
    doneReply = STOP_FOR_OTHER_REPLY
  }

  const handled = accepted || (saved.pending && isYes(text))
  const lookup = handled ? null : requestToLookUp(contents('user'), ctx, conversationDates())
  if (lookup) {
    history.push({ role: 'assistant', content: '', tool_calls: [{ function: { name: 'ver_horarios', arguments: lookup } }] })
    history.push({ role: 'tool', tool_name: 'ver_horarios', content: JSON.stringify(runTool('ver_horarios', lookup)) })
  }

  const clearChange = handled ? null : changeRequest(text, lastReply?.content ?? '', ctx, conversationDates())
  if (!handled && wantsChange(text) && aboutSomeoneElse) doneReply = ONLY_OWN_REPLY
  else if (!handled && (wantsChange(text) || clearChange || asksOwnAppointments(text))) {
    history.push({ role: 'assistant', content: '', tool_calls: [{ function: { name: 'ver_meus_horarios', arguments: {} } }] })
    history.push({ role: 'tool', tool_name: 'ver_meus_horarios', content: JSON.stringify(runTool('ver_meus_horarios', {})) })
  }
  if (clearChange && !aboutSomeoneElse) {
    const { tool, args } = clearChange
    history.push({ role: 'assistant', content: '', tool_calls: [{ function: { name: tool, arguments: args } }] })
    history.push({ role: 'tool', tool_name: tool, content: JSON.stringify(runTool(tool, args)) })
  }

  let reply = SAFE_REPLY
  let barred = 0
  // O que muda a agenda sai escrito pelo sistema. A IA só responde se a pessoa perguntou mais alguma coisa.
  const settled = () => pending !== null || (doneReply !== null && !text.includes('?'))
  for (let round = 0; round < MAX_ROUNDS && !settled(); round++) {
    const answer = await chat([{ role: 'system', content: systemPrompt(ctx) }, ...history], ASSISTANT_TOOLS)
    if (answer.toolCalls.length) {
      history.push({ role: 'assistant', content: answer.content, tool_calls: answer.toolCalls })
      for (const call of answer.toolCalls) {
        const { name, arguments: args } = call.function
        history.push({ role: 'tool', tool_name: name, content: JSON.stringify(runTool(name, args ?? {})) })
      }
      continue
    }

    const times = timesIn(contents('tool'), contents('user'), ctx.assistant.opensAt, ctx.assistant.closesAt)
    const offered = timesIn(contents('tool'), [], ctx.assistant.opensAt)
    // Vale o dia que veio do sistema, mesmo que o horário já tenha saído da agenda ao desmarcar.
    const fromTools = contents('tool').flatMap((content) => [...content.matchAll(/\b(\d{2})\/(\d{2})\b/g)]).flatMap(([, day, month]) => readDate(`${day}/${month}`, today) ?? [])
    const dates = [...conversationDates(), ...ctx.ownAppointments.map(({ date }) => date), ...fromTools]
    const problem = findInvented(answer.content, { times, offered, dates, booked: booked || saved.booked, changed: changed || saved.changed, available, previousReply: lastReply?.content }, ctx)
    if (!problem) {
      reply = listServicesInLines(answer.content.trim(), ctx.services)
      break
    }
    trail.push(`Resposta barrada: ${problem}`)
    barred += 1
    if (barred >= MAX_RETRIES_WITH_ANSWER && (available || doneReply)) break
    history.push({ role: 'system', content: `Sua resposta não foi enviada. ${problem} Escreva de novo.` })
  }
  if (reply === SAFE_REPLY && doneReply) reply = doneReply
  else if (reply === SAFE_REPLY && available) reply = availabilityReply(available)
  // O sim só vale se a pessoa viu o que vai mudar.
  const waiting = pending as PendingChange | null
  if (waiting) reply = waiting.question

  // Número desconhecido sempre recebe o pedido do nome, mesmo se a IA esquecer.
  if (!ctx.customerName && !stopped && !/\bnome\b/i.test(reply)) reply = `${reply}\n\n${ASK_NAME}`

  saveConversation(db, returnClientId, contact, {
    messages: [...history.filter(({ role }) => role !== 'system'), { role: 'assistant', content: reply }],
    customerName: ctx.customerName === knownName ? saved.customerName : ctx.customerName,
    booked: booked || saved.booked,
    changed: changed || saved.changed,
    pending,
  })
  return { reply, booked, trail }
}
