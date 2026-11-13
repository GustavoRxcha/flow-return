import { mergeImport, snoozeUntil } from './endCustomers'
import type { ParsedEndCustomer } from './table'
import type { AppState, EndCustomer, Settings } from './types'

export type Action =
  | { type: 'import'; customers: ParsedEndCustomer[] }
  | { type: 'markSent'; phone: string; today: string }
  | { type: 'skip'; phone: string; today: string }
  | { type: 'block'; phone: string }
  | { type: 'markReturned'; phone: string; today: string; value?: number }
  | { type: 'backToQueue'; phone: string }
  | { type: 'settings'; settings: Partial<Settings> }

function update(state: AppState, phone: string, change: (customer: EndCustomer) => EndCustomer): AppState {
  return {
    ...state,
    customers: state.customers.map((customer) => (customer.phone === phone ? change(customer) : customer)),
  }
}

export function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'import':
      return { ...state, customers: mergeImport(state.customers, action.customers) }
    case 'markSent':
      return update(state, action.phone, (customer) =>
        customer.status === 'nao_chamar'
          ? customer
          : {
              ...customer,
              status: customer.status === 'voltou' ? 'voltou' : 'chamado',
              contactedAt: action.today,
              snoozedUntil: undefined,
            },
      )
    case 'skip':
      return update(state, action.phone, (customer) => ({
        ...customer,
        snoozedUntil: snoozeUntil(action.today),
      }))
    case 'block':
      return update(state, action.phone, (customer) => ({ ...customer, status: 'nao_chamar' }))
    case 'markReturned':
      return update(state, action.phone, (customer) => ({
        ...customer,
        status: 'voltou',
        returnedAt: action.today,
        returnedValue: action.value,
        lastVisit: action.today,
      }))
    case 'backToQueue':
      return update(state, action.phone, (customer) => ({
        ...customer,
        status: 'novo',
        contactedAt: undefined,
      }))
    case 'settings':
      return { ...state, settings: { ...state.settings, ...action.settings } }
  }
}
