import { Check, ChevronDown, Moon, Sun } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import br from '../assets/flags/br.svg'
import es from '../assets/flags/es.svg'
import us from '../assets/flags/us.svg'
import { LOCALES, type Locale } from '../lib/i18n'
import { usePreferences } from './Preferences'

const FLAGS: Record<Locale, string> = { pt: br, en: us, es }

/** Idioma com bandeira e tema claro ou escuro. Ficam no topo de todas as telas. */
export function TopbarControls() {
  return (
    <>
      <LanguageMenu />
      <ThemeToggle />
    </>
  )
}

function LanguageMenu() {
  const { locale, setLocale, t } = usePreferences()
  const [open, setOpen] = useState(false)
  const box = useRef<HTMLDivElement>(null)
  const current = LOCALES.find(({ id }) => id === locale)!

  useEffect(() => {
    if (!open) return
    const outside = (event: PointerEvent) => {
      if (!box.current?.contains(event.target as Node)) setOpen(false)
    }
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', outside)
    document.addEventListener('keydown', escape)
    return () => {
      document.removeEventListener('pointerdown', outside)
      document.removeEventListener('keydown', escape)
    }
  }, [open])

  return (
    <div ref={box} className="fr-lang">
      <button
        type="button"
        className="ef-button ef-button--ghost ef-button--sm fr-lang__button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`${t('topbar.language')}: ${current.label}`}
        onClick={() => setOpen(!open)}
      >
        <img className="fr-flag" src={FLAGS[locale]} alt="" />
        <span>{current.short}</span>
        <ChevronDown size={16} strokeWidth={2} aria-hidden="true" />
      </button>
      {open && (
        <div className="fr-lang__menu" role="menu" aria-label={t('topbar.language')}>
          {LOCALES.map((item) => (
            <button
              key={item.id}
              type="button"
              role="menuitemradio"
              aria-checked={item.id === locale}
              lang={item.htmlLang}
              className="ef-button ef-button--ghost ef-button--sm ef-button--full fr-lang__option"
              onClick={() => {
                setLocale(item.id)
                setOpen(false)
              }}
            >
              <img className="fr-flag" src={FLAGS[item.id]} alt="" />
              <span className="fr-lang__name">{item.label}</span>
              {item.id === locale && <Check size={16} strokeWidth={2} aria-hidden="true" />}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function ThemeToggle() {
  const { theme, toggleTheme, t } = usePreferences()
  const dark = theme === 'dark'
  const label = t(dark ? 'topbar.toLight' : 'topbar.toDark')
  return (
    <button type="button" className="ef-button ef-button--ghost ef-button--sm fr-icon-button" aria-label={label} title={label} onClick={toggleTheme}>
      {dark ? <Sun size={18} strokeWidth={2} aria-hidden="true" /> : <Moon size={18} strokeWidth={2} aria-hidden="true" />}
    </button>
  )
}
