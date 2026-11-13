import { appointmentEnd } from '../src/lib/agenda.ts'
import type { Appointment } from '../src/lib/types.ts'

const TIMEZONE = 'America/Sao_Paulo'
const encoder = new TextEncoder()

function escapeText(text: string): string {
  return text.replace(/\\/g, '\\\\').replace(/;/g, '\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n')
}

/** Quebra em até 75 bytes, sem partir acentos, como pede o formato iCalendar. */
function fold(line: string): string {
  const parts: string[] = []
  let current = ''
  let size = 0
  for (const char of line) {
    const bytes = encoder.encode(char).length
    if (size + bytes > 75) {
      parts.push(current)
      current = ' '
      size = 1
    }
    current += char
    size += bytes
  }
  parts.push(current)
  return parts.join('\r\n')
}

function stamp(date: string, time: string): string {
  return `${date.replaceAll('-', '')}T${time.replace(':', '')}00`
}

export function buildIcs(appointments: Appointment[], businessName: string, now: Date): string {
  const created = now.toISOString().replace(/[-:]|\.\d{3}/g, '')
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Flow Return//Agenda//PT-BR',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeText(businessName)}`,
    `X-WR-TIMEZONE:${TIMEZONE}`,
    'REFRESH-INTERVAL;VALUE=DURATION:PT1H',
    'X-PUBLISHED-TTL:PT1H',
    'BEGIN:VTIMEZONE',
    `TZID:${TIMEZONE}`,
    'BEGIN:STANDARD',
    'DTSTART:19700101T000000',
    'TZOFFSETFROM:-0300',
    'TZOFFSETTO:-0300',
    'TZNAME:-03',
    'END:STANDARD',
    'END:VTIMEZONE',
  ]
  for (const item of appointments) {
    const end = appointmentEnd(item)
    lines.push(
      'BEGIN:VEVENT',
      `UID:${item.id}@flowreturn`,
      `DTSTAMP:${created}`,
      `DTSTART;TZID=${TIMEZONE}:${stamp(item.date, item.time)}`,
      `DTEND;TZID=${TIMEZONE}:${stamp(end.date, end.time)}`,
      `SUMMARY:${escapeText(`${item.customerName} · ${item.service} · ${item.professionalName}`)}`,
      'END:VEVENT',
    )
  }
  lines.push('END:VCALENDAR')
  return `${lines.map(fold).join('\r\n')}\r\n`
}
