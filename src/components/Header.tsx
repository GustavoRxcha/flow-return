import dark from '../../design-system/assets/Logos/flow-return-branco.svg'
import light from '../../design-system/assets/Logos/flow-return-preto.svg'
import { usePreferences } from './Preferences'
import { TopbarControls } from './TopbarControls'

/** Logo preto no tema claro e branco no escuro, como pede o design system. */
export function Logo() {
  return (
    <>
      <img className="ef-navbar__logo ef-only-light" src={light} alt="Flow Return" />
      <img className="ef-navbar__logo ef-only-dark" src={dark} alt="Flow Return" />
    </>
  )
}

interface Props {
  subtitle: string
  onLogout: () => void
  onSettings?: () => void
}

export function Header({ subtitle, onLogout, onSettings }: Props) {
  const { t } = usePreferences()
  return (
    <header className="fr-topbar">
      <div>
        <Logo />
      </div>
      <p className="fr-topbar__name label">{subtitle}</p>
      <div className="fr-topbar__actions">
        <div className="ef-row fr-topbar__group fr-topbar__prefs">
          <TopbarControls />
        </div>
        <div className="ef-row fr-topbar__group fr-topbar__account">
        {onSettings && (
          <button type="button" className="ef-button ef-button--ghost ef-button--sm" onClick={onSettings}>
            {t('topbar.settings')}
          </button>
        )}
        <button type="button" className="ef-button ef-button--ghost ef-button--sm" onClick={onLogout}>
          {t('topbar.logout')}
        </button>
        </div>
      </div>
    </header>
  )
}
