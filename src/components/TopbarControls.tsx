import { Check, ChevronDown, CircleUserRound, Moon, Sun } from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
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

/** Botão que abre uma lista flutuante. Fecha ao tocar fora ou com Esc. */
function PopoverMenu({
  label,
  trigger,
  triggerClass,
  children,
}: {
  label: string
  trigger: ReactNode
  triggerClass: string
  children: (close: () => void) => ReactNode
}) {
  const [open, setOpen] = useState(false)
  const box = useRef<HTMLDivElement>(null)

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
    <div ref={box} className="fr-menu">
      <button type="button" className={triggerClass} aria-haspopup="menu" aria-expanded={open} aria-label={label} onClick={() => setOpen(!open)}>
        {trigger}
      </button>
      {open && (
        <div className="fr-menu__list" role="menu" aria-label={label}>
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  )
}

function LanguageMenu() {
  const { locale, setLocale, t } = usePreferences()
  const current = LOCALES.find(({ id }) => id === locale)!
  return (
    <PopoverMenu
      label={`${t('topbar.language')}: ${current.label}`}
      triggerClass="ef-button ef-button--ghost ef-button--sm fr-lang__button"
      trigger={
        <>
          <img className="fr-flag" src={FLAGS[locale]} alt="" />
          <span className="fr-lang__code">{current.short}</span>
          <ChevronDown size={16} strokeWidth={2} aria-hidden="true" />
        </>
      }
    >
      {(close) =>
        LOCALES.map((item) => (
          <button
            key={item.id}
            type="button"
            role="menuitemradio"
            aria-checked={item.id === locale}
            lang={item.htmlLang}
            className="ef-button ef-button--ghost ef-button--sm ef-button--full fr-menu__option"
            onClick={() => {
              setLocale(item.id)
              close()
            }}
          >
            <img className="fr-flag" src={FLAGS[item.id]} alt="" />
            <span className="fr-menu__name">{item.label}</span>
            {item.id === locale && <Check size={16} strokeWidth={2} aria-hidden="true" />}
          </button>
        ))
      }
    </PopoverMenu>
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

/** No celular, nome do negócio, Ajustes e Sair cabem num menu só, e o topo fica em uma linha. */
export function AccountMenu({ subtitle, onSettings, onLogout }: { subtitle: string; onSettings?: () => void; onLogout: () => void }) {
  const { t } = usePreferences()
  return (
    <PopoverMenu
      label={subtitle}
      triggerClass="ef-button ef-button--ghost ef-button--sm fr-icon-button"
      trigger={<CircleUserRound size={20} strokeWidth={2} aria-hidden="true" />}
    >
      {(close) => (
        <>
          <p className="label fr-menu__title">{subtitle}</p>
          {onSettings && (
            <button
              type="button"
              role="menuitem"
              className="ef-button ef-button--ghost ef-button--sm ef-button--full fr-menu__option"
              onClick={() => {
                close()
                onSettings()
              }}
            >
              {t('topbar.settings')}
            </button>
          )}
          <button type="button" role="menuitem" className="ef-button ef-button--ghost ef-button--sm ef-button--full fr-menu__option" onClick={onLogout}>
            {t('topbar.logout')}
          </button>
        </>
      )}
    </PopoverMenu>
  )
}
