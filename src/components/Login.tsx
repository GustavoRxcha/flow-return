import { useState, type FormEvent } from 'react'
import { api, ApiError } from '../lib/api'
import type { MessageKey } from '../lib/i18n'
import { Logo } from './Header'
import { usePreferences } from './Preferences'
import { TopbarControls } from './TopbarControls'

const MESSAGES: Record<string, MessageKey> = {
  login_invalido: 'login.invalid',
  muitas_tentativas: 'login.tooMany',
}

export function Login({ onSuccess }: { onSuccess: () => Promise<void> }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const { t } = usePreferences()

  async function submit(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      await api('/login', { body: { email, password } })
      await onSuccess()
    } catch (failure) {
      const code = failure instanceof ApiError ? failure.code : ''
      setError(t(MESSAGES[code] ?? 'login.failed'))
      setBusy(false)
    }
  }

  return (
    <main className="fr-page fr-page--solo">
      <nav className="ef-navbar" aria-label="Flow Return">
        <div>
          <Logo />
        </div>
        <div className="ef-row fr-topbar__group">
          <TopbarControls />
        </div>
      </nav>
      <form className="ef-stack" onSubmit={submit}>
        <h1 className="display-md">{t('login.title')}</h1>
        <label className="ef-field">
          <span className="ef-field__label">{t('login.email')}</span>
          <input
            className="ef-input"
            type="email"
            autoComplete="username"
            required
            aria-invalid={error ? true : undefined}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </label>
        <label className="ef-field">
          <span className="ef-field__label">{t('login.password')}</span>
          <input
            className="ef-input"
            type="password"
            autoComplete="current-password"
            required
            aria-invalid={error ? true : undefined}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
          {error && <span className="ef-field__error" role="alert">{error}</span>}
        </label>
        <button type="submit" className="ef-button ef-button--primary ef-button--full" disabled={busy}>
          {busy ? t('login.busy') : t('login.submit')}
        </button>
      </form>
    </main>
  )
}
