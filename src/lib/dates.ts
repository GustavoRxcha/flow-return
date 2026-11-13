const DAY_MS = 86_400_000

function pad(value: number): string {
  return String(value).padStart(2, '0')
}

function toIso(year: number, month: number, day: number): string | null {
  const date = new Date(Date.UTC(year, month - 1, day))
  const isReal =
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  return isReal ? `${year}-${pad(month)}-${pad(day)}` : null
}

/** Aceita DD/MM/AAAA, DD-MM-AAAA, DD.MM.AAAA, DD/MM/AA e AAAA-MM-DD. */
export function parseDate(raw: string): string | null {
  const text = raw.trim().split(/[ T]/)[0]
  const iso = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)
  if (iso) return toIso(Number(iso[1]), Number(iso[2]), Number(iso[3]))
  const br = text.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})$/)
  if (!br) return null
  const year = br[3].length === 2 ? 2000 + Number(br[3]) : Number(br[3])
  return toIso(year, Number(br[2]), Number(br[1]))
}

export function todayIso(now: Date = new Date()): string {
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

export function addDays(iso: string, days: number): string {
  const [year, month, day] = iso.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day + days))
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`
}

export function daysBetween(fromIso: string, toIsoDate: string): number {
  const [fy, fm, fd] = fromIso.split('-').map(Number)
  const [ty, tm, td] = toIsoDate.split('-').map(Number)
  return Math.round((Date.UTC(ty, tm - 1, td) - Date.UTC(fy, fm - 1, fd)) / DAY_MS)
}

function addMonths(iso: string, months: number): string {
  const [year, month, day] = iso.split('-').map(Number)
  const first = new Date(Date.UTC(year, month - 1 + months, 1))
  const lastDay = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate()
  return `${first.getUTCFullYear()}-${pad(first.getUTCMonth() + 1)}-${pad(Math.min(day, lastDay))}`
}

function counted(value: number, one: string, many: string): string | null {
  if (value === 0) return null
  return value === 1 ? `1 ${one}` : `${value} ${many}`
}

/** Tempo exato pelo calendário, respeitando meses de 28, 30 e 31 dias: "2 meses e 6 dias". */
export function elapsedTime(fromIso: string, toIsoDate: string): string {
  const [fromYear, fromMonth] = fromIso.split('-').map(Number)
  const [toYear, toMonth] = toIsoDate.split('-').map(Number)
  let months = (toYear - fromYear) * 12 + toMonth - fromMonth
  if (addMonths(fromIso, months) > toIsoDate) months -= 1
  const days = daysBetween(addMonths(fromIso, months), toIsoDate)
  const parts = [
    counted(Math.floor(months / 12), 'ano', 'anos'),
    counted(months % 12, 'mês', 'meses'),
    counted(days, 'dia', 'dias'),
  ].filter(Boolean) as string[]
  if (parts.length === 0) return 'menos de um dia'
  return parts.length === 1 ? parts[0] : `${parts.slice(0, -1).join(', ')} e ${parts[parts.length - 1]}`
}

export function formatDate(iso: string): string {
  const [year, month, day] = iso.split('-')
  return `${day}/${month}/${year}`
}
