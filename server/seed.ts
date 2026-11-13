import { getAssistant, saveAssistant } from './assistant.ts'
import { hashPassword, newId } from './auth.ts'
import type { Db } from './db.ts'
import { createAppointment, createProfessional, createService, listProfessionals } from './repo.ts'
import { addDays } from '../src/lib/dates.ts'
import { DEFAULT_TEMPLATE } from '../src/lib/types.ts'
import type { AssistantSettings, EndCustomer, PlanId } from '../src/lib/types.ts'

/**
 * Contas fictícias para testar em ambiente local. Nunca rodar em produção.
 * As mesmas credenciais estão em docs/CONTAS-DE-TESTE.md.
 */
export const TEST_ACCOUNTS = {
  gestor: { name: 'Gustavo', email: 'gestor@flowreturn.test', password: 'gestor-return-2026' },
  barbearia: { name: 'Seu Bigode', email: 'barbearia@flowreturn.test', password: 'barbearia-return-2026' },
  massagem: { name: 'Dra. Helena', email: 'massagem@flowreturn.test', password: 'massagem-return-2026' },
}

type Preset = [name: string, daysAgo: number, service: string, status?: EndCustomer['status'], value?: number]

const BARBEARIA: Preset[] = [
  ['Rafael Lima', 64, 'Corte e barba'],
  ['Bruno Teixeira', 78, 'Corte'],
  ['Pedro Antunes', 95, 'Barba'],
  ['Thiago Moraes', 130, 'Corte'],
  ['Caio Fontes', 88, 'Corte e barba', 'chamado'],
  ['Marcos Vieira', 72, 'Corte', 'voltou', 70],
  ['Diego Paz', 15, 'Corte'],
]

const MASSAGEM: Preset[] = [
  ['Marina Souza', 70, 'Massagem relaxante'],
  ['Carla Mendes', 84, 'Drenagem linfática'],
  ['Juliana Rocha', 112, 'Massagem relaxante'],
  ['Fernanda Dias', 160, 'Pedras quentes'],
  ['Renata Alves', 66, 'Quick massage', 'chamado'],
  ['Patrícia Nunes', 90, 'Drenagem linfática', 'voltou', 180],
  ['Beatriz Costa', 20, 'Massagem relaxante'],
]

function addReturnClient(
  db: Db,
  today: string,
  account: { name: string; email: string; password: string },
  business: { name: string; segment: string; plan: PlanId; phoneBase: number },
  people: Preset[],
) {
  const id = newId()
  db.prepare(
    `INSERT INTO return_clients (id, name, segment, plan, status, demo, inactive_days, daily_limit, template, created_at)
     VALUES (?, ?, ?, ?, 'ativo', 1, 60, 20, ?, ?)`,
  ).run(id, business.name, business.segment, business.plan, DEFAULT_TEMPLATE, new Date().toISOString())
  db.prepare(
    `INSERT INTO users (id, email, name, password_hash, role, return_client_id) VALUES (?, ?, ?, ?, 'cliente_return', ?)`,
  ).run(newId(), account.email, account.name, hashPassword(account.password), id)
  createProfessional(db, id, account.name)

  const insert = db.prepare(
    `INSERT INTO end_customers (return_client_id, phone, name, last_visit, service, status, contacted_at, returned_at, returned_value)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
  people.forEach(([name, daysAgo, service, status = 'novo', value], index) => {
    const contactedAt = status === 'novo' ? null : addDays(today, -4)
    const returnedAt = status === 'voltou' ? addDays(today, -1) : null
    insert.run(
      id,
      `55119${String(business.phoneBase + index + 1).padStart(8, '0')}`,
      name,
      returnedAt ?? addDays(today, -daysAgo),
      service,
      status,
      contactedAt,
      returnedAt,
      value ?? null,
    )
  })
}

export function seedIfEmpty(db: Db, today: string): boolean {
  if (db.prepare('SELECT 1 FROM users LIMIT 1').get()) return false

  db.prepare(`INSERT INTO users (id, email, name, password_hash, role) VALUES (?, ?, ?, ?, 'gestor')`).run(
    newId(),
    TEST_ACCOUNTS.gestor.email,
    TEST_ACCOUNTS.gestor.name,
    hashPassword(TEST_ACCOUNTS.gestor.password),
  )
  addReturnClient(
    db,
    today,
    TEST_ACCOUNTS.barbearia,
    { name: 'Barbearia do Bigode', segment: 'Barbearia', plan: 'basico', phoneBase: 1000 },
    BARBEARIA,
  )
  addReturnClient(
    db,
    today,
    TEST_ACCOUNTS.massagem,
    { name: 'Clínica Sereno Massagem', segment: 'Clínica de massagem', plan: 'medio', phoneBase: 2000 },
    MASSAGEM,
  )
  return true
}

type DemoAppointment = [customerName: string, service: string, daysAhead: number, time: string, minutes: number]

const DEMO_AGENDA: Record<string, DemoAppointment[]> = {
  'Barbearia do Bigode': [
    ['Marcos Vieira', 'Corte', 0, '15:00', 30],
    ['Diego Paz', 'Corte', 0, '16:30', 30],
    ['Caio Fontes', 'Corte e barba', 1, '10:00', 60],
    ['Bruno Teixeira', 'Corte', 3, '14:00', 30],
    ['Pedro Antunes', 'Barba', -2, '11:00', 30],
  ],
  'Clínica Sereno Massagem': [
    ['Patrícia Nunes', 'Drenagem linfática', 0, '14:00', 60],
    ['Beatriz Costa', 'Massagem relaxante', 1, '09:00', 60],
    ['Renata Alves', 'Quick massage', 2, '17:00', 30],
    ['Carla Mendes', 'Drenagem linfática', -3, '10:00', 60],
  ],
}

type DemoService = [name: string, durationMinutes: number, reais: number]

const DEMO_SERVICES: Record<string, DemoService[]> = {
  'Barbearia do Bigode': [
    ['Corte', 30, 45],
    ['Barba', 30, 35],
    ['Corte e barba', 60, 70],
  ],
  'Clínica Sereno Massagem': [
    ['Massagem relaxante', 60, 120],
    ['Drenagem linfática', 60, 150],
    ['Quick massage', 30, 60],
    ['Pedras quentes', 90, 180],
  ],
}

/** Endereços fictícios. A acessibilidade da barbearia fica sem resposta de propósito, para testar o que falta. */
export const DEMO_ASSISTANTS: Record<string, Pick<AssistantSettings, 'name' | 'info'>> = {
  'Barbearia do Bigode': {
    name: 'Bia',
    info: {
      address: 'Avenida 9 de Julho, 1200, Vila Nova, São Paulo',
      reference: 'Ao lado da Padaria Pão Quente',
      parking: false,
      walkIn: true,
      accessibility: null,
      children: true,
      payments: ['pix', 'dinheiro', 'debito'],
    },
  },
  'Clínica Sereno Massagem': {
    name: 'Helô',
    info: {
      address: 'Rua das Acácias, 45, Jardim Sereno, São Paulo',
      reference: '',
      parking: true,
      walkIn: false,
      accessibility: true,
      children: false,
      payments: ['pix', 'dinheiro', 'debito', 'credito'],
    },
  },
}

/** Cada parte roda uma vez por banco, para os dados de teste não voltarem depois de apagados. */
export function seedDemoAgenda(db: Db, today: string): void {
  const { user_version: version } = db.prepare('PRAGMA user_version').get() as { user_version: number }
  if (version >= 3) return
  const clients = db.prepare('SELECT id, name FROM return_clients WHERE demo = 1').all() as unknown as Array<{
    id: string
    name: string
  }>
  for (const client of clients) {
    const [professional] = listProfessionals(db, client.id)
    const agenda = version >= 1 ? [] : (DEMO_AGENDA[client.name] ?? [])
    for (const [customerName, service, daysAhead, time, durationMinutes] of agenda) {
      createAppointment(db, client.id, {
        professionalId: professional.id,
        customerName,
        service,
        date: addDays(today, daysAhead),
        time,
        durationMinutes,
        priceCents: null,
      })
    }
    for (const [name, durationMinutes, reais] of version >= 2 ? [] : (DEMO_SERVICES[client.name] ?? [])) {
      createService(db, client.id, { name, durationMinutes, priceCents: reais * 100 })
    }
    const assistant = DEMO_ASSISTANTS[client.name]
    if (assistant) saveAssistant(db, client.id, { ...getAssistant(db, client.id), ...assistant })
  }
  db.exec('PRAGMA user_version = 3')
}
