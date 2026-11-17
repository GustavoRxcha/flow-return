import type { PlanId } from './types'

export type PlanFeatureKey = 'lostList' | 'readyMessage' | 'moneyBack' | 'autoReminder' | 'fillCancelled' | 'googleReview' | 'aiAssistant'

export interface PlanFeature {
  /** Nome na tela, traduzido por `plan.feature.<key>`. */
  key: PlanFeatureKey
  label: string
  /** Só marcamos como disponível o que já funciona de verdade. */
  available: boolean
}

export interface Plan {
  id: PlanId
  name: string
  /** Preço ainda em teste. */
  monthlyPrice: number
  features: PlanFeature[]
}

const BASE: PlanFeature[] = [
  { key: 'lostList', label: 'Lista de clientes sumidos', available: true },
  { key: 'readyMessage', label: 'Mensagem pronta para o WhatsApp', available: true },
  { key: 'moneyBack', label: 'Painel do dinheiro que voltou', available: true },
]

const MEDIUM: PlanFeature[] = [
  { key: 'autoReminder', label: 'Confirmação e lembrete automáticos', available: false },
  { key: 'fillCancelled', label: 'Encaixe de horários cancelados', available: false },
  { key: 'googleReview', label: 'Pedido de avaliação no Google', available: false },
]

export const PLANS: Record<PlanId, Plan> = {
  basico: { id: 'basico', name: 'Básico', monthlyPrice: 97, features: BASE },
  medio: { id: 'medio', name: 'Médio', monthlyPrice: 197, features: [...BASE, ...MEDIUM] },
  avancado: {
    id: 'avancado',
    name: 'Avançado',
    monthlyPrice: 397,
    features: [...BASE, ...MEDIUM, { key: 'aiAssistant', label: 'Atendente com IA', available: false }],
  },
}
