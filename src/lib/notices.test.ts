import { describe, expect, it } from 'vitest'
import { ownerNoticeLine, ownerNoticeText } from './notices'

const event = { kind: 'marcado' as const, customerName: 'Ana Souza', summary: 'Pezinho, sexta-feira, 20/11, às 14:00, com Cleber' }

describe('avisos para o dono', () => {
  it('linha curta, sem quebra, para caber no modelo da Meta', () => {
    expect(ownerNoticeLine(event)).toBe('Novo agendamento: Ana Souza. Pezinho, sexta-feira, 20/11, às 14:00, com Cleber.')
    expect(ownerNoticeLine(event)).not.toContain('\n')
  })

  it('pula duas linhas antes do link do painel', () => {
    expect(ownerNoticeText(event, 'https://painel.test')).toBe(`${ownerNoticeLine(event)}\n\n\nVer no painel: https://painel.test`)
    expect(ownerNoticeText({ ...event, kind: 'desmarcado' })).toMatch(/^Horário desmarcado: Ana Souza\./)
  })
})
