const currency = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  maximumFractionDigits: 0,
})

const exactCurrency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

export function formatMoney(value: number): string {
  return currency.format(value)
}

export function formatCents(cents: number): string {
  return exactCurrency.format(cents / 100)
}

/** Valor em centavos pronto para aparecer em um campo, como 45,00. */
export function centsInput(cents: number | null): string {
  return cents === null ? '' : (cents / 100).toFixed(2).replace('.', ',')
}

/** Lê valores digitados como 80, 80,50 ou 1.250,00. */
export function parseMoney(raw: string): number | undefined {
  const text = raw.trim().replace(/^R\$\s*/i, '')
  if (!text) return undefined
  const thousands = text.includes(',') || /^\d{1,3}(\.\d{3})+$/.test(text)
  const normalized = thousands ? text.replace(/\./g, '').replace(',', '.') : text
  const value = Number(normalized)
  return Number.isFinite(value) && value >= 0 ? value : undefined
}

export function parseCents(raw: string): number | undefined {
  const value = parseMoney(raw)
  return value === undefined ? undefined : Math.round(value * 100)
}
