import { parseDate, todayIso } from './dates'
import { normalizeBrPhone } from './phone'

export interface ParsedEndCustomer {
  name: string
  phone: string
  lastVisit: string
  service?: string
}

export interface ImportIssue {
  line: number
  reason: string
}

export interface ImportResult {
  customers: ParsedEndCustomer[]
  issues: ImportIssue[]
  missingColumns: string[]
}

const COLUMN_ALIASES = {
  name: ['nome', 'cliente', 'nome do cliente', 'name'],
  phone: ['telefone', 'celular', 'whatsapp', 'whats', 'fone', 'contato', 'phone', 'tel'],
  lastVisit: [
    'ultima visita',
    'ultimo atendimento',
    'ultima compra',
    'ultimo servico',
    'data',
    'data da visita',
    'data do atendimento',
    'last visit',
  ],
  service: ['servico', 'procedimento', 'produto', 'atendimento', 'service'],
} as const

type Column = keyof typeof COLUMN_ALIASES

const COLUMN_LABELS: Record<Column, string> = {
  name: 'nome',
  phone: 'telefone',
  lastVisit: 'última visita',
  service: 'serviço',
}

function normalizeHeader(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

function detectDelimiter(headerLine: string): string {
  const candidates = ['\t', ';', ',']
  return candidates.reduce((best, delimiter) =>
    headerLine.split(delimiter).length > headerLine.split(best).length ? delimiter : best,
  )
}

/** Separa linhas e células respeitando aspas, como no CSV do Excel. */
function parseRows(text: string, delimiter: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false

  for (let i = 0; i < text.length; i++) {
    const char = text[i]
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') {
        cell += '"'
        i++
      } else if (char === '"') {
        quoted = false
      } else {
        cell += char
      }
    } else if (char === '"' && cell === '') {
      quoted = true
    } else if (char === delimiter) {
      row.push(cell)
      cell = ''
    } else if (char === '\n') {
      row.push(cell)
      rows.push(row)
      row = []
      cell = ''
    } else if (char !== '\r') {
      cell += char
    }
  }
  row.push(cell)
  rows.push(row)
  return rows
}

function titleCase(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/(^|\s)(\p{L})/gu, (_, space: string, letter: string) => space + letter.toUpperCase())
    .replace(/\s(Da|De|Do|Das|Dos|E)(?=\s)/g, (match) => match.toLowerCase())
}

export function parseEndCustomerTable(text: string, today: string = todayIso()): ImportResult {
  const clean = text.replace(/^﻿/, '').trim()
  if (!clean) return { customers: [], issues: [], missingColumns: [] }

  const rows = parseRows(clean, detectDelimiter(clean.split(/\r?\n/)[0]))
  const headers = rows[0].map(normalizeHeader)

  const indexes = {} as Record<Column, number>
  for (const column of Object.keys(COLUMN_ALIASES) as Column[]) {
    const aliases: readonly string[] = COLUMN_ALIASES[column]
    indexes[column] = headers.findIndex((header) => aliases.includes(header))
  }

  const required: Column[] = ['name', 'phone', 'lastVisit']
  const missingColumns = required
    .filter((column) => indexes[column] === -1)
    .map((column) => COLUMN_LABELS[column])
  if (missingColumns.length > 0) return { customers: [], issues: [], missingColumns }

  const byPhone = new Map<string, ParsedEndCustomer>()
  const issues: ImportIssue[] = []

  rows.slice(1).forEach((row, index) => {
    const line = index + 2
    if (row.every((cell) => cell.trim() === '')) return

    const name = titleCase(row[indexes.name] ?? '')
    const phone = normalizeBrPhone(row[indexes.phone] ?? '')
    const lastVisit = parseDate(row[indexes.lastVisit] ?? '')
    const service = indexes.service >= 0 ? row[indexes.service]?.trim() : undefined

    if (!name) return void issues.push({ line, reason: 'sem nome' })
    if (!phone) return void issues.push({ line, reason: `telefone inválido de ${name}` })
    if (!lastVisit) return void issues.push({ line, reason: `data inválida de ${name}` })
    if (lastVisit > today) return void issues.push({ line, reason: `data futura de ${name}` })

    const existing = byPhone.get(phone)
    if (!existing || lastVisit > existing.lastVisit) {
      byPhone.set(phone, { name, phone, lastVisit, service: service || undefined })
    }
  })

  return { customers: [...byPhone.values()], issues, missingColumns: [] }
}
