import { elapsedTime } from './dates'
import type { EndCustomer, Settings } from './types'

export function renderMessage(
  customer: Pick<EndCustomer, 'name' | 'lastVisit' | 'service'>,
  settings: Pick<Settings, 'businessName' | 'template'>,
  today: string,
  nextVisit = '',
): string {
  const values: Record<string, string> = {
    nome: customer.name.split(' ')[0],
    negocio: settings.businessName.trim() || 'de atendimento',
    tempo: elapsedTime(customer.lastVisit, today),
    servico: customer.service?.trim() || 'atendimento',
    proximo: nextVisit,
  }
  return settings.template.replace(/\{(nome|negocio|tempo|servico|proximo)\}/g, (_, key: string) => values[key])
}
