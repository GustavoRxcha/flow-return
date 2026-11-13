/** Normaliza um telefone brasileiro para 55 + DDD + número, ou devolve null. */
export function normalizeBrPhone(raw: string): string | null {
  let digits = raw.replace(/\D/g, '').replace(/^0+/, '')
  if (digits.startsWith('55') && digits.length >= 12) digits = digits.slice(2)
  if (digits.length !== 10 && digits.length !== 11) return null
  if (digits[0] === '0' || digits[1] === '0') return null
  if (digits.length === 11 && digits[2] !== '9') return null
  return `55${digits}`
}

/** O WhatsApp pode entregar celular antigo sem o 9. O cadastro guarda sempre com o 9. */
export function phoneFromWhatsApp(raw: string): string | null {
  const phone = normalizeBrPhone(raw)
  if (!phone) return null
  return phone.length === 12 && phone[4] >= '6' ? `${phone.slice(0, 4)}9${phone.slice(4)}` : phone
}

export function formatBrPhone(phone: string): string {
  const local = phone.slice(2)
  const ddd = local.slice(0, 2)
  const number = local.slice(2)
  const split = number.length - 4
  return `(${ddd}) ${number.slice(0, split)}-${number.slice(split)}`
}
