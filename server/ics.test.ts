import { describe, expect, it } from 'vitest'
import { buildIcs } from './ics.ts'
import type { Appointment } from '../src/lib/types.ts'

const base: Appointment = {
  id: 'a1',
  professionalId: 'p1',
  professionalName: 'Seu Bigode',
  customerName: 'Rafael Lima',
  service: 'Corte, barba; sobrancelha',
  date: '2026-11-06',
  time: '23:45',
  durationMinutes: 30,
  priceCents: null,
}
const now = new Date('2026-11-05T12:00:00.000Z')

describe('arquivo de calendário', () => {
  it('monta o horário, inclusive quando termina no dia seguinte', () => {
    const ics = buildIcs([base], 'Barbearia', now)
    expect(ics).toContain('DTSTART;TZID=America/Sao_Paulo:20261106T234500\r\n')
    expect(ics).toContain('DTEND;TZID=America/Sao_Paulo:20261107T001500\r\n')
    expect(ics).toContain('DTSTAMP:20261105T120000Z\r\n')
  })

  it('mostra quem atende', () => {
    expect(buildIcs([base], 'Barbearia', now).replace(/\r\n /g, '')).toContain('· Seu Bigode')
  })

  it('protege vírgula e ponto e vírgula', () => {
    expect(buildIcs([base], 'Barbearia', now)).toContain('Corte\\, barba\; sobrancelha')
  })

  it('não passa de 75 bytes por linha nem parte acentos', () => {
    const long = { ...base, service: 'Massagem relaxante com ação prolongada '.repeat(4) }
    const ics = buildIcs([long], 'Clínica', now)
    const lines = ics.split('\r\n')
    expect(lines.every((line) => new TextEncoder().encode(line).length <= 75)).toBe(true)
    expect(ics.replace(/\r\n /g, '')).toContain(long.service.trim())
    expect(ics).not.toContain('\ufffd')
  })
})
