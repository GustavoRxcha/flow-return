import { useCallback, useEffect, useState } from 'react'
import { GestorApp } from './components/GestorApp'
import { Login } from './components/Login'
import { ReturnClientApp } from './components/ReturnClientApp'
import { api, ApiError } from './lib/api'
import type { ReturnClient, SessionUser } from './lib/types'

interface Session {
  user: SessionUser
  returnClient: ReturnClient | null
}

export function App() {
  const [session, setSession] = useState<Session | null | undefined>(undefined)
  const [failed, setFailed] = useState(false)

  const refresh = useCallback(async () => {
    try {
      setSession(await api<Session>('/me'))
      setFailed(false)
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) setSession(null)
      else setFailed(true)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  async function logout() {
    await api('/logout', { method: 'POST' })
    setSession(null)
  }

  if (failed) return <p className="fr-status">Não foi possível conectar. Tente de novo em instantes.</p>
  if (session === undefined) return <p className="fr-status">Carregando...</p>
  if (session === null) return <Login onSuccess={refresh} />
  if (session.user.role === 'gestor') return <GestorApp user={session.user} onLogout={logout} />
  return <ReturnClientApp key={session.user.id} returnClient={session.returnClient!} onLogout={logout} />
}
