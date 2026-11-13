import { describe, expect, it } from 'vitest'
import { dayHours, findConflict, freeProfessionals, layoutDay, monthLabel, monthWeeks, shiftMonth, weekDays } from './agenda'
import { assistedChannel } from './channel'
import { buildQueue, computeMetrics, mergeImport } from './endCustomers'
import { daysBetween, elapsedTime, parseDate } from './dates'
import { renderMessage } from './message'
import { formatBrPhone, normalizeBrPhone } from './phone'
import { reducer } from './reducer'
import { absenceTone, buildRoster, filterRoster, messageFor } from './roster'
import { parseEndCustomerTable } from './table'
import { monthFinance } from './finance'
import { centsInput, formatCents, parseCents } from './format'
import type { Appointment, AppState, EndCustomer } from './types'
import { DEFAULT_SETTINGS } from './types'

const TODAY = '2026-11-05'

function customer(overrides: Partial<EndCustomer> = {}): EndCustomer {
  return { name: 'Ana', phone: '5511999990001', lastVisit: '2026-08-01', status: 'novo', ...overrides }
}

describe('telefone', () => {
  it.each([
    ['(11) 99999-0001', '5511999990001'],
    ['+55 11 99999-0001', '5511999990001'],
    ['011 99999 0001', '5511999990001'],
    ['1133334444', '551133334444'],
  ])('normaliza %s', (raw, expected) => {
    expect(normalizeBrPhone(raw)).toBe(expected)
  })

  it.each(['', '99990001', '11899990001', '00999990001', '123'])('rejeita %s', (raw) => {
    expect(normalizeBrPhone(raw)).toBeNull()
  })

  it('não confunde o DDD 55 com o código do país', () => {
    expect(normalizeBrPhone('55999990001')).toBe('5555999990001')
  })

  it('formata para leitura', () => {
    expect(formatBrPhone('5511999990001')).toBe('(11) 99999-0001')
    expect(formatBrPhone('551133334444')).toBe('(11) 3333-4444')
  })
})

describe('datas', () => {
  it.each([
    ['31/08/2026', '2026-08-31'],
    ['1-8-26', '2026-08-01'],
    ['2026-08-31', '2026-08-31'],
    ['31/08/2026 14:30', '2026-08-31'],
  ])('entende %s', (raw, expected) => {
    expect(parseDate(raw)).toBe(expected)
  })

  it.each(['31/02/2026', '2026-13-01', 'ontem', ''])('rejeita %s', (raw) => {
    expect(parseDate(raw)).toBeNull()
  })

  it('conta dias e fala como gente', () => {
    expect(daysBetween('2026-09-06', TODAY)).toBe(60)
    expect(elapsedTime('2026-11-02', TODAY)).toBe('3 dias')
    expect(elapsedTime('2026-10-04', TODAY)).toBe('1 mês e 1 dia')
    expect(elapsedTime('2026-08-27', TODAY)).toBe('2 meses e 9 dias')
    expect(elapsedTime('2026-05-29', TODAY)).toBe('5 meses e 7 dias')
    expect(elapsedTime('2026-09-05', TODAY)).toBe('2 meses')
    expect(elapsedTime('2025-09-01', TODAY)).toBe('1 ano, 2 meses e 4 dias')
    expect(elapsedTime('2024-11-05', TODAY)).toBe('2 anos')
    expect(elapsedTime(TODAY, TODAY)).toBe('menos de um dia')
  })

  it('conta meses curtos pelo calendário', () => {
    expect(elapsedTime('2026-01-31', '2026-02-28')).toBe('1 mês')
    expect(elapsedTime('2026-01-31', '2026-03-01')).toBe('1 mês e 1 dia')
    expect(elapsedTime('2026-01-30', '2026-02-27')).toBe('28 dias')
  })
})

describe('importação', () => {
  it('lê CSV do Excel com ponto e vírgula, acentos e BOM', () => {
    const text = '﻿Nome;Celular;Última visita;Serviço\nANA DA SILVA;(11) 99999-0001;01/08/2026;Corte\n'
    const { customers, issues } = parseEndCustomerTable(text, TODAY)
    expect(issues).toEqual([])
    expect(customers).toEqual([
      { name: 'Ana da Silva', phone: '5511999990001', lastVisit: '2026-08-01', service: 'Corte' },
    ])
  })

  it('lê texto colado da planilha, separado por tabulação', () => {
    const text = 'cliente\twhatsapp\tdata\nBia\t11999990002\t2026-08-02'
    expect(parseEndCustomerTable(text, TODAY).customers).toHaveLength(1)
  })

  it('respeita vírgula dentro de aspas', () => {
    const text = 'nome,telefone,data,servico\n"Bia",11999990002,02/08/2026,"Corte, barba"'
    expect(parseEndCustomerTable(text, TODAY).customers[0].service).toBe('Corte, barba')
  })

  it('avisa quais colunas faltam', () => {
    expect(parseEndCustomerTable('nome,idade\nBia,30', TODAY).missingColumns).toEqual([
      'telefone',
      'última visita',
    ])
  })

  it('separa as linhas ruins sem perder as boas', () => {
    const text = [
      'nome,telefone,data',
      'Boa,11999990001,01/08/2026',
      'Tel,123,01/08/2026',
      'Dat,11999990002,99/99/2026',
      'Fut,11999990003,01/01/2030',
      ',11999990004,01/08/2026',
      '',
    ].join('\n')
    const { customers, issues } = parseEndCustomerTable(text, TODAY)
    expect(customers.map((c) => c.name)).toEqual(['Boa'])
    expect(issues.map((i) => i.line)).toEqual([3, 4, 5, 6])
  })

  it('une telefones repetidos e fica com a visita mais recente', () => {
    const text = 'nome,telefone,data\nBia,11999990001,01/03/2026\nBia,11999990001,01/08/2026'
    const { customers } = parseEndCustomerTable(text, TODAY)
    expect(customers).toHaveLength(1)
    expect(customers[0].lastVisit).toBe('2026-08-01')
  })
})

describe('mensagem', () => {
  it('usa o primeiro nome e o tempo em linguagem natural', () => {
    const text = renderMessage(
      customer({ name: 'Ana da Silva', lastVisit: '2026-08-01' }),
      { businessName: 'Studio Bia', template: 'Oi, {nome}! {negocio}: {tempo}, {servico}.' },
      TODAY,
    )
    expect(text).toBe('Oi, Ana! Studio Bia: 3 meses e 4 dias, atendimento.')
  })
})

describe('fila', () => {
  it('traz só quem está sumido, disponível e nunca chamado', () => {
    const queue = buildQueue(
      [
        customer({ phone: 'recente', lastVisit: '2026-10-20' }),
        customer({ phone: 'antigo', lastVisit: '2026-01-01' }),
        customer({ phone: 'sumido', lastVisit: '2026-08-01' }),
        customer({ phone: 'chamado', status: 'chamado' }),
        customer({ phone: 'bloqueado', status: 'nao_chamar' }),
        customer({ phone: 'adiado', snoozedUntil: '2026-11-10' }),
        customer({ phone: 'liberado', snoozedUntil: '2026-11-05', lastVisit: '2026-07-01' }),
      ],
      DEFAULT_SETTINGS,
      TODAY,
    )
    expect(queue.map((c) => c.phone)).toEqual(['sumido', 'liberado', 'antigo'])
  })
})

describe('nova importação', () => {
  it('mantém o bloqueio de quem pediu para não ser chamado', () => {
    const merged = mergeImport([customer({ status: 'nao_chamar' })], [
      { name: 'Ana', phone: '5511999990001', lastVisit: '2026-10-01' },
    ])
    expect(merged[0].status).toBe('nao_chamar')
  })

  it('conta retorno quando a visita nova vem depois da mensagem, sem inventar valor', () => {
    const merged = mergeImport([customer({ status: 'chamado', contactedAt: '2026-10-01' })], [
      { name: 'Ana', phone: '5511999990001', lastVisit: '2026-10-15' },
    ])
    expect(merged[0]).toMatchObject({ status: 'voltou', returnedAt: '2026-10-15' })
    expect(merged[0].returnedValue).toBeUndefined()
  })

  it('não conta retorno se a visita é anterior à mensagem', () => {
    const merged = mergeImport([customer({ status: 'chamado', contactedAt: '2026-10-01' })], [
      { name: 'Ana', phone: '5511999990001', lastVisit: '2026-09-15' },
    ])
    expect(merged[0].status).toBe('chamado')
  })
})

describe('jornada e números do painel', () => {
  it('soma só valores informados e respeita o limite do dia', () => {
    const initial: AppState = {
      demo: false,
      settings: { ...DEFAULT_SETTINGS, dailyLimit: 2 },
      customers: [customer({ phone: 'a' }), customer({ phone: 'b' }), customer({ phone: 'c' })],
    }
    let state = reducer(initial, { type: 'markSent', phone: 'a', today: TODAY })
    state = reducer(state, { type: 'markSent', phone: 'b', today: TODAY })
    state = reducer(state, { type: 'markReturned', phone: 'a', today: TODAY, value: 80 })

    expect(computeMetrics(state, TODAY)).toMatchObject({
      inQueue: 1,
      waiting: 1,
      contacted: 2,
      returned: 1,
      recoveredValue: 80,
      returnRate: 0.5,
      sentToday: 2,
      leftToday: 0,
    })
  })

  it('deixa desfazer um envio marcado por engano', () => {
    const start: AppState = { demo: false, settings: DEFAULT_SETTINGS, customers: [customer()] }
    const sent = reducer(start, { type: 'markSent', phone: customer().phone, today: TODAY })
    const undone = reducer(sent, { type: 'backToQueue', phone: customer().phone })
    expect(undone.customers[0]).toMatchObject({ status: 'novo', contactedAt: undefined })
  })
})

describe('conector assistido', () => {
  it('monta o link do WhatsApp com o texto codificado', async () => {
    const result = await assistedChannel.send({ phone: '5511999990001', text: 'Oi, Ana! Tudo bem?' })
    expect(result).toEqual({
      kind: 'open-url',
      url: 'https://wa.me/5511999990001?text=Oi%2C%20Ana!%20Tudo%20bem%3F',
    })
  })
})

describe('calendário', () => {
  const slot = (id: string, time: string, durationMinutes: number): Appointment => ({
    id,
    professionalId: 'p1',
    professionalName: 'Seu Bigode',
    customerName: id,
    service: 'Corte',
    date: TODAY,
    time,
    durationMinutes,
    priceCents: null,
  })

  it('um período ocupado vale só para o profissional que atende nele', () => {
    const people = [{ id: 'p1', name: 'Um' }, { id: 'p2', name: 'Dois' }]
    const taken = [slot('Ana', '16:00', 30)]
    const wanted = { customerName: 'Bia', service: 'Corte', date: TODAY, time: '16:00', durationMinutes: 30, priceCents: null }

    expect(findConflict(taken, { ...wanted, professionalId: 'p1' })?.id).toBe('Ana')
    expect(findConflict(taken, { ...wanted, professionalId: 'p2' })).toBeNull()
    expect(freeProfessionals(people, taken, wanted).map((item) => item.id)).toEqual(['p2'])

    const both = [...taken, { ...slot('Caio', '16:15', 30), professionalId: 'p2' }]
    expect(freeProfessionals(people, both, wanted)).toEqual([])
    expect(freeProfessionals(people, both, { ...wanted, time: '16:45' }).map((item) => item.id)).toEqual(['p1', 'p2'])
  })

  it('monta o mês de domingo a sábado', () => {
    const weeks = monthWeeks('2026-11-20')
    expect(weeks[0][0]).toBe('2026-11-01')
    expect(weeks).toHaveLength(5)
    expect(weeks.flat().filter(Boolean)).toHaveLength(30)
    expect(monthWeeks('2026-02-01').flat().filter(Boolean)).toHaveLength(28)
    expect(monthWeeks('2028-02-01').flat().filter(Boolean)).toHaveLength(29)
    expect(monthWeeks('2026-08-01')[0].slice(0, 7).filter(Boolean)).toEqual(['2026-08-01'])
  })

  it('acha a semana mesmo na virada do ano', () => {
    expect(weekDays('2027-01-01')[0]).toBe('2026-12-27')
    expect(weekDays('2027-01-01')[6]).toBe('2027-01-02')
  })

  it('troca de mês e volta para hoje no mês atual', () => {
    expect(shiftMonth(TODAY, 2, TODAY)).toBe('2027-01-01')
    expect(shiftMonth(TODAY, -1, TODAY)).toBe('2026-10-01')
    expect(shiftMonth('2026-12-01', -1, TODAY)).toBe(TODAY)
    expect(monthLabel('2026-03-01')).toBe('Março 2026')
  })

  it('aumenta a faixa de horas para caber tudo', () => {
    expect(dayHours([])).toEqual({ first: 7, last: 21 })
    expect(dayHours([slot('a', '05:30', 30), slot('b', '23:00', 120)])).toEqual({ first: 5, last: 24 })
  })

  it('divide a largura só entre quem se sobrepõe', () => {
    const placed = layoutDay(
      [slot('a', '09:00', 60), slot('b', '09:30', 60), slot('c', '11:00', 30)],
      7,
      21,
    )
    expect(placed.map(({ item, column, columns }) => [item.id, column, columns])).toEqual([
      ['a', 0, 2],
      ['b', 1, 2],
      ['c', 0, 1],
    ])
    expect(placed[0].start).toBe(2)
    expect(placed[2].length).toBe(0.5)
  })

  it('reaproveita a coluna livre e não passa do fim do dia', () => {
    const placed = layoutDay([slot('a', '09:00', 120), slot('b', '09:00', 30), slot('c', '09:30', 30)], 7, 21)
    expect(placed.map(({ column }) => column)).toEqual([0, 1, 1])
    expect(layoutDay([slot('z', '23:30', 120)], 7, 24)[0].length).toBe(0.5)
  })
})

describe('tabela de clientes finais', () => {
  it('troca todas as variáveis de um texto pronto pelos dados reais', () => {
    const template = 'Oi, {nome}! Aqui é da {negocio}. Faz {tempo}. Serviço: {servico}. Horário: {proximo}.'
    const text = renderMessage(
      { name: 'Ana Souza', lastVisit: '2026-09-01', service: 'Corte' },
      { businessName: 'Barbearia do Bigode', template },
      TODAY,
      '10/11/2026 às 14:00',
    )
    expect(text).toBe('Oi, Ana! Aqui é da Barbearia do Bigode. Faz 2 meses e 4 dias. Serviço: Corte. Horário: 10/11/2026 às 14:00.')
  })

  const person = (name: string, phone: string, lastVisit: string, status: EndCustomer['status'] = 'novo'): EndCustomer => ({
    name,
    phone,
    lastVisit,
    status,
  })
  const slot = (customerName: string, date: string): Appointment => ({
    id: `${customerName}${date}`,
    professionalId: 'p1',
    professionalName: 'Seu Bigode',
    customerName,
    service: 'Corte',
    date,
    time: '10:00',
    durationMinutes: 30,
    priceCents: null,
  })
  const customers = [
    person('Ana Souza', '5511911110000', '2026-10-01'),
    person('João Lima', '5511922220000', '2026-06-01'),
    person('Bia Paz', '5521933330000', '2026-08-01'),
  ]
  const rows = buildRoster(
    customers,
    [slot('joão lima ', '2026-12-01'), slot('Ana Souza', '2026-11-10'), slot('Ana Souza', '2026-11-20'), slot('Bia Paz', '2026-10-20')],
    TODAY,
  )
  const names = (list: typeof rows) => list.map((row) => row.customer.name)
  const base = { search: '', next: 'todos', sort: 'ultimo-antigo' } as const

  it('acha o próximo atendimento e atualiza o último com horário passado', () => {
    expect(rows[0].next?.date).toBe('2026-11-10')
    expect(rows[1].next?.date).toBe('2026-12-01')
    expect(rows[2].next).toBeNull()
    expect(rows[2].lastVisit).toBe('2026-10-20')
  })

  it('usa no lembrete o mesmo último atendimento da tabela', () => {
    const carla = person('Carla Mendes', '5511955550000', '2026-08-23')
    const [row] = buildRoster([carla], [slot('Carla Mendes', '2026-11-02')], TODAY)
    const settings = { ...DEFAULT_SETTINGS, businessName: 'Clínica' }
    expect(messageFor(row, settings, 'Faz {tempo}.', TODAY)).toBe('Faz 3 dias.')
  })

  it('classifica os dias sem vir nos limites de 15 e 30', () => {
    expect([0, 15, 16, 30, 31].map(absenceTone)).toEqual(['recente', 'recente', 'atencao', 'atencao', 'distante'])
  })

  it('busca por nome sem acento e por telefone', () => {
    expect(names(filterRoster(rows, { ...base, search: 'joao' }))).toEqual(['João Lima'])
    expect(names(filterRoster(rows, { ...base, search: '(21) 9333' }))).toEqual(['Bia Paz'])
  })

  it('combina sem próximo atendimento com quem veio há mais tempo', () => {
    const list = [...rows, buildRoster([person('Caio', '5511944440000', '2026-01-01')], [], TODAY)[0]]
    expect(names(filterRoster(list, { ...base, next: 'sem' }))).toEqual(['Caio', 'Bia Paz'])
  })

  it('ordena nos dois sentidos e deixa quem não marcou no fim', () => {
    expect(names(filterRoster(rows, { ...base, sort: 'nome-za' }))).toEqual(['João Lima', 'Bia Paz', 'Ana Souza'])
    expect(names(filterRoster(rows, { ...base, sort: 'proximo-perto' }))).toEqual(['Ana Souza', 'João Lima', 'Bia Paz'])
    expect(names(filterRoster(rows, { ...base, sort: 'proximo-longe' }))).toEqual(['João Lima', 'Ana Souza', 'Bia Paz'])
    expect(names(filterRoster(rows, { ...base, sort: 'telefone-maior' }))[0]).toBe('Bia Paz')
  })

  it('enviar não apaga quem voltou nem alcança quem pediu para parar', () => {
    const state: AppState = {
      demo: false,
      settings: { ...DEFAULT_SETTINGS },
      customers: [person('A', '1', TODAY, 'voltou'), person('B', '2', TODAY, 'nao_chamar')],
    }
    const sent = ['1', '2'].reduce((current, phone) => reducer(current, { type: 'markSent', phone, today: TODAY }), state)
    expect(sent.customers.map((customer) => customer.status)).toEqual(['voltou', 'nao_chamar'])
    expect(sent.customers[1].contactedAt).toBeUndefined()
  })
})

describe('financeiro do mês', () => {
  const people = [{ id: 'p1', name: 'Um' }, { id: 'p2', name: 'Dois' }]
  const now = { date: '2026-11-15', time: '12:00' }
  const slot = (
    id: string,
    date: string,
    time: string,
    priceCents: number | null,
    professionalId = 'p1',
    service = 'Corte',
  ): Appointment => ({
    id,
    professionalId,
    professionalName: people.find((item) => item.id === professionalId)?.name ?? 'Saiu',
    customerName: id,
    service,
    date,
    time,
    durationMinutes: 30,
    priceCents,
  })

  it('separa o recebido do que ainda vai entrar pelo fim do horário', () => {
    const finance = monthFinance(
      [
        slot('a', '2026-11-02', '10:00', 4500),
        slot('b', '2026-11-15', '11:30', 3500),
        slot('c', '2026-11-15', '11:45', 7000),
        slot('d', '2026-11-20', '10:00', 4500),
        slot('e', '2026-12-01', '10:00', 9900),
      ],
      people,
      '2026-11',
      now,
    )
    expect(finance.receivedCents).toBe(8000)
    expect(finance.expectedCents).toBe(11500)
    expect(finance.averageCents).toBe(4000)
  })

  it('divide por profissional e mantém quem saiu da lista', () => {
    const finance = monthFinance(
      [
        slot('a', '2026-11-02', '10:00', 3000),
        slot('b', '2026-11-03', '10:00', 8000, 'p2'),
        slot('c', '2026-11-04', '10:00', 1000, 'p3'),
        slot('d', '2026-11-20', '10:00', 9000),
      ],
      people,
      '2026-11',
      now,
    )
    expect(finance.byProfessional.map(({ name, attended, cents }) => [name, attended, cents])).toEqual([
      ['Dois', 1, 8000],
      ['Um', 1, 3000],
      ['Saiu', 1, 1000],
    ])
  })

  it('não estima horário sem valor', () => {
    const finance = monthFinance(
      [slot('a', '2026-11-02', '10:00', 4000), slot('b', '2026-11-03', '10:00', null), slot('c', '2026-11-20', '10:00', null)],
      people,
      '2026-11',
      now,
    )
    expect(finance.receivedCents).toBe(4000)
    expect(finance.averageCents).toBe(4000)
    expect(finance.withoutPrice).toBe(2)
    expect(finance.byProfessional[0].attended).toBe(2)
  })

  it('lista os serviços mais agendados, juntando maiúsculas e horários futuros', () => {
    const finance = monthFinance(
      [
        slot('a', '2026-11-02', '10:00', null, 'p1', 'Barba'),
        slot('b', '2026-11-03', '10:00', null, 'p1', 'Corte'),
        slot('c', '2026-11-20', '10:00', null, 'p1', 'corte '),
      ],
      people,
      '2026-11',
      now,
    )
    expect(finance.topServices).toEqual([{ name: 'Corte', count: 2 }, { name: 'Barba', count: 1 }])
  })

  it('mês vazio não tem ticket médio', () => {
    const finance = monthFinance([], people, '2026-11', now)
    expect(finance.averageCents).toBeNull()
    expect(finance.byProfessional).toHaveLength(2)
  })

  it('lê e mostra valores em reais', () => {
    expect(parseCents('45')).toBe(4500)
    expect(parseCents('45,90')).toBe(4590)
    expect(parseCents('1.250,50')).toBe(125050)
    expect(parseCents('1.250')).toBe(125000)
    expect(parseCents('abc')).toBeUndefined()
    expect(centsInput(4590)).toBe('45,90')
    expect(formatCents(125050).replace(/\s/g, ' ')).toBe('R$ 1.250,50')
  })
})
