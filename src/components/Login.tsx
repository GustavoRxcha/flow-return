import { useState, type FormEvent } from 'react'
import logo from '../../design-system/assets/Logos/flow-return-preto.svg'
import { api, ApiError } from '../lib/api'

const MESSAGES: Record<string, string> = {
  login_invalido: 'E-mail ou senha incorretos.',
  muitas_tentativas: 'Muitas tentativas. Aguarde alguns minutos.',
}

export function Login({ onSuccess }: { onSuccess: () => Promise<void> }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      await api('/login', { body: { email, password } })
      await onSuccess()
    } catch (failure) {
      const code = failure instanceof ApiError ? failure.code : ''
      setError(MESSAGES[code] ?? 'Não foi possível entrar. Tente de novo.')
      setBusy(false)
    }
  }

  return (
    <main className="fr-page fr-page--solo">
      <nav className="ef-navbar" aria-label="Flow Return">
        <img className="ef-navbar__logo" src={logo} alt="Flow Return" />
      </nav>
      <form className="ef-stack" onSubmit={submit}>
        <h1 className="display-md">Entrar.</h1>
        <label className="ef-field">
          <span className="ef-field__label">E-mail</span>
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
          <span className="ef-field__label">Senha</span>
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
          {busy ? 'Entrando...' : 'Entrar'}
        </button>
      </form>
    </main>
  )
}
