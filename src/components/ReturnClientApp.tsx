import { useCallback, useEffect, useMemo, useState } from 'react'
import { api, ApiError } from '../lib/api'
import { computeMetrics } from '../lib/endCustomers'
import type { AppState, ReturnClient } from '../lib/types'
import { Agenda, type AgendaTarget } from './Agenda'
import { AssistantPanel } from './AssistantPanel'
import { Empty } from './Empty'
import { EndCustomers } from './EndCustomers'
import { Header } from './Header'
import { Home } from './Home'
import { ImportPanel } from './ImportPanel'
import { Services } from './Services'
import { SettingsPanel } from './SettingsPanel'

type Tab = 'inicio' | 'clientes' | 'agenda' | 'servicos' | 'atendente' | 'ajustes'

const PAGE_CLASS: Record<Tab, string> = {
  inicio: 'fr-page fr-page--wide fr-page--home',
  clientes: 'fr-page fr-page--wide',
  agenda: 'fr-page fr-page--wide',
  servicos: 'fr-page fr-page--wide',
  atendente: 'fr-page fr-page--wide',
  ajustes: 'fr-page',
}

export type ClientAction = Record<string, unknown> & { type: string }
export type Dispatch = (action: ClientAction) => void

interface Workspace {
  state: AppState
  today: string
}

interface Props {
  returnClient: ReturnClient
  onLogout: () => void
}

export function ReturnClientApp({ returnClient, onLogout }: Props) {
  const [workspace, setWorkspace] = useState<Workspace | null>(null)
  const [paused, setPaused] = useState(returnClient.status === 'pausado')
  const [error, setError] = useState('')
  const [tab, setTab] = useState<Tab>('inicio')
  const [agendaTarget, setAgendaTarget] = useState<AgendaTarget | null>(null)

  const handleFailure = useCallback((failure: unknown) => {
    if (failure instanceof ApiError && failure.code === 'conta_pausada') setPaused(true)
    else setError('Não foi possível salvar. Tente de novo.')
  }, [])

  useEffect(() => {
    if (paused) return
    api<Workspace>('/workspace').then(setWorkspace).catch(handleFailure)
  }, [paused, handleFailure])

  const dispatch: Dispatch = useCallback(
    (action) => {
      setError('')
      api<Workspace>('/workspace/actions', { body: action }).then(setWorkspace).catch(handleFailure)
    },
    [handleFailure],
  )

  const importList = useCallback(
    async (text: string) => {
      setError('')
      try {
        setWorkspace(await api<Workspace>('/workspace/import', { body: { text } }))
        return true
      } catch (failure) {
        handleFailure(failure)
        return false
      }
    },
    [handleFailure],
  )

  const refresh = useCallback(() => {
    api<Workspace>('/workspace').then(setWorkspace).catch(handleFailure)
  }, [handleFailure])

  const metrics = useMemo(
    () => (workspace ? computeMetrics(workspace.state, workspace.today) : null),
    [workspace],
  )

  if (paused) {
    return (
      <>
        <Header subtitle={returnClient.name} onLogout={onLogout} />
        <main className="fr-page fr-page--solo">
        <Empty title="Conta pausada." text="Fale com a Flow Return para reativar o acesso." />
        </main>
      </>
    )
  }

  if (!workspace || !metrics) {
    return <p className="fr-status">{error || 'Carregando...'}</p>
  }

  const { state, today } = workspace
  const subtitle = state.settings.businessName

  if (state.customers.length === 0) {
    return (
      <>
        <Header subtitle={subtitle} onLogout={onLogout} />
        <main className="fr-page fr-page--solo">
        <div className="fr-stack-lg">
          <div className="ef-stack">
            <h1 className="display-md">Traga de volta quem sumiu.</h1>
            <p className="ef-card__text">Envie sua lista e veja quem está há mais tempo sem aparecer.</p>
          </div>
          <ImportPanel onImport={importList} />
          {error && <p className="ef-alert ef-alert--danger" role="alert">{error}</p>}
        </div>
        </main>
      </>
    )
  }

  const tabs: Array<{ id: Tab; label: string }> = [
    { id: 'inicio', label: 'Início' },
    { id: 'clientes', label: 'Clientes' },
    { id: 'agenda', label: 'Agenda' },
    { id: 'servicos', label: 'Serviços' },
    { id: 'atendente', label: 'Atendente IA' },
  ]

  return (
    <>
      <Header subtitle={subtitle} onLogout={onLogout} onSettings={() => setTab('ajustes')} />
      <main className={PAGE_CLASS[tab]}>
        <div className="fr-stack-lg">
          {state.demo && <p className="ef-alert">Conta de teste. O envio não abre o WhatsApp.</p>}
          {error && <p className="ef-alert ef-alert--danger" role="alert">{error}</p>}
        {tab === 'inicio' && (
          <Home
            metrics={metrics}
            today={today}
            onStart={() => setTab('clientes')}
            onOpenAgenda={(target) => {
              setAgendaTarget(target)
              setTab('agenda')
            }}
            onFailure={handleFailure}
          />
        )}
        {tab === 'agenda' && (
          <Agenda
            customerNames={state.customers.map((customer) => customer.name)}
            target={agendaTarget}
            onFailure={handleFailure}
          />
        )}
        {tab === 'servicos' && <Services onFailure={handleFailure} />}
        {tab === 'atendente' && (
          <AssistantPanel
            inQueue={metrics.inQueue}
            inactiveDays={state.settings.inactiveDays}
            dailyLimit={state.settings.dailyLimit}
            customers={state.customers}
            onFailure={handleFailure}
            onDataChanged={refresh}
          />
        )}
        {tab === 'clientes' && <EndCustomers state={state} metrics={metrics} today={today} dispatch={dispatch} onFailure={handleFailure} />}
        {tab === 'ajustes' && (
          <SettingsPanel
            state={state}
            plan={returnClient.plan}
            dispatch={dispatch}
            onImport={importList}
            onFailure={handleFailure}
          />
        )}
      </div>
      </main>
      <nav className="ef-bottomnav fr-nav" aria-label="Seções">
        {tabs.map((item) => (
          <button
            key={item.id}
            type="button"
            className="ef-bottomnav__item"
            aria-current={item.id === tab ? 'page' : undefined}
            onClick={() => {
              setAgendaTarget(null)
              setTab(item.id)
            }}
          >
            {item.label}
          </button>
        ))}
      </nav>
    </>
  )
}
