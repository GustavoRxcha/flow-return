import logo from '../../design-system/assets/Logos/flow-return-preto.svg'

interface Props {
  subtitle: string
  onLogout: () => void
  onSettings?: () => void
}

export function Header({ subtitle, onLogout, onSettings }: Props) {
  return (
    <header className="fr-topbar">
      <img className="ef-navbar__logo" src={logo} alt="Flow Return" />
      <p className="fr-topbar__name label">{subtitle}</p>
      <div className="ef-row fr-topbar__actions">
        {onSettings && (
          <button type="button" className="ef-button ef-button--ghost ef-button--sm" onClick={onSettings}>
            Ajustes
          </button>
        )}
        <button type="button" className="ef-button ef-button--ghost ef-button--sm" onClick={onLogout}>
          Sair
        </button>
      </div>
    </header>
  )
}
