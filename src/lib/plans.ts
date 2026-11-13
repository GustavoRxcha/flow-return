import type { PlanId } from './types'

export interface PlanFeature {
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
  { label: 'Lista de clientes sumidos', available: true },
  { label: 'Mensagem pronta para o WhatsApp', available: true },
  { label: 'Painel do dinheiro que voltou', available: true },
]

const MEDIUM: PlanFeature[] = [
  { label: 'Confirmação e lembrete automáticos', available: false },
  { label: 'Encaixe de horários cancelados', available: false },
  { label: 'Pedido de avaliação no Google', available: false },
]

export const PLANS: Record<PlanId, Plan> = {
  basico: { id: 'basico', name: 'Básico', monthlyPrice: 97, features: BASE },
  medio: { id: 'medio', name: 'Médio', monthlyPrice: 197, features: [...BASE, ...MEDIUM] },
  avancado: {
    id: 'avancado',
    name: 'Avançado',
    monthlyPrice: 397,
    features: [...BASE, ...MEDIUM, { label: 'Atendente com IA', available: false }],
  },
}
