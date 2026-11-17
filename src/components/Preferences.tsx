import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  DEFAULT_LOCALE,
  intlOf,
  isLocale,
  LOCALES,
  translate,
  translateList,
  translatePlural,
  type Locale,
  type MessageKey,
  type Params,
  type PluralKey,
} from '../lib/i18n'

export type Theme = 'light' | 'dark'

const LOCALE_KEY = 'fr-locale'
const THEME_KEY = 'fr-theme'

/** O navegador pode bloquear o armazenamento. Sem ele, a escolha vale até fechar a aba. */
function read(key: string): string | null {
  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}

function write(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value)
  } catch {
    // Sem armazenamento: segue sem guardar.
  }
}

export function savedLocale(): Locale {
  const value = read(LOCALE_KEY)
  return isLocale(value) ? value : DEFAULT_LOCALE
}

/** O design system começa sempre no tema claro. O escuro é escolha da pessoa. */
export function savedTheme(): Theme {
  return read(THEME_KEY) === 'dark' ? 'dark' : 'light'
}

/** Aplica idioma e tema no documento. Roda antes da primeira tela, para não piscar. */
export function applyPreferences(locale: Locale, theme: Theme): void {
  const root = document.documentElement
  root.lang = LOCALES.find(({ id }) => id === locale)!.htmlLang
  root.dataset.theme = theme
  const surface = getComputedStyle(root).getPropertyValue('--surface').trim()
  if (surface) document.querySelector('meta[name="theme-color"]')?.setAttribute('content', surface)
}

interface PreferencesValue {
  locale: Locale
  theme: Theme
  setLocale: (locale: Locale) => void
  toggleTheme: () => void
  t: (key: MessageKey, params?: Params) => string
  tp: (key: PluralKey, count: number, params?: Params) => string
  tl: (key: MessageKey) => string[]
  /** Etiqueta de idioma para `Intl` e `toLocaleDateString`. */
  intl: string
}

const PreferencesContext = createContext<PreferencesValue | null>(null)

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(savedLocale)
  const [theme, setTheme] = useState<Theme>(savedTheme)

  useEffect(() => applyPreferences(locale, theme), [locale, theme])

  const setLocale = useCallback((next: Locale) => {
    write(LOCALE_KEY, next)
    setLocaleState(next)
  }, [])

  const toggleTheme = useCallback(() => {
    setTheme((current) => {
      const next = current === 'dark' ? 'light' : 'dark'
      write(THEME_KEY, next)
      return next
    })
  }, [])

  const value = useMemo<PreferencesValue>(
    () => ({
      locale,
      theme,
      setLocale,
      toggleTheme,
      t: (key, params) => translate(locale, key, params),
      tp: (key, count, params) => translatePlural(locale, key, count, params),
      tl: (key) => translateList(locale, key),
      intl: intlOf(locale),
    }),
    [locale, theme, setLocale, toggleTheme],
  )

  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>
}

export function usePreferences(): PreferencesValue {
  const value = useContext(PreferencesContext)
  if (!value) throw new Error('usePreferences precisa estar dentro de PreferencesProvider')
  return value
}
