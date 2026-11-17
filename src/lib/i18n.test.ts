import { describe, expect, it } from 'vitest'
import { LOCALES, MESSAGE_KEYS, translate, translatePlural } from './i18n'

describe('idiomas', () => {
  it('toda chave tem texto nos três idiomas e as mesmas variáveis', () => {
    for (const key of MESSAGE_KEYS) {
      const variables = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map(([, name]) => name).sort()
      const base = variables(translate('pt', key))
      for (const { id } of LOCALES) {
        const text = translate(id, key)
        expect(text.trim(), `${id}: ${key}`).not.toBe('')
        expect(variables(text), `${id}: ${key}`).toEqual(base)
      }
    }
  })

  it('troca só as variáveis informadas', () => {
    expect(translate('pt', 'settings.templateHint')).toContain('{nome}')
    expect(translate('en', 'customers.select', { name: 'Ana' })).toBe('Select Ana')
  })

  it('usa singular só para 1', () => {
    expect(translatePlural('pt', 'customers.days', 1)).toBe('1 dia')
    expect(translatePlural('es', 'customers.days', 0)).toBe('0 días')
    expect(translatePlural('en', 'customers.days', 3)).toBe('3 days')
  })
})
