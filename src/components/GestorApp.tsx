import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { api, ApiError } from '../lib/api'
import { formatMoney } from '../lib/format'
import { PLANS } from '../lib/plans'
import type { AccountStatus, PlanId, ReturnClient, SessionUser } from '../lib/types'
import { ConfirmDialog } from './ConfirmDialog'
import { Header } from './Header'
import { Stat } from './Stat'

interface ClientSummary extends ReturnClient {
  ownerName: string | null
  ownerEmail: string | null
  lastLoginAt: string | null
  inactiveDays: number
  dailyLimit: number
  endCustomers: number
  inQueue: number
  contacted: number
  returned: number
  recoveredValue: number
}

interface Overview {
  clients: ClientSummary[]
  totals: {
    returnClients: number
    active: number
    endCustomers: number
    returned: number
    recoveredValue: number
  }
}

function formatLogin(iso: string | null): string {
  if (!iso) return 'Nunca entrou'
  const date = new Date(iso)
  return `Último acesso em ${date.toLocaleDateString('pt-BR')}`
}

export function GestorApp({ user, onLogout }: { user: SessionUser; onLogout: () => void }) {
  const [overview, setOverview] = useState<Overview | null>(null)
  const [error, setError] = useState('')
  const [creating, setCreating] = useState(false)

  const load = useCallback(async () => {
    try {
      setOverview(await api<Overview>('/admin/overview'))
      setError('')
    } catch {
      setError('Não foi possível carregar os dados.')
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <>
      <Header subtitle={`Gestor · ${user.name}`} onLogout={onLogout} />
      <main className="fr-page fr-page--wide fr-page--solo">
      {error && <p className="ef-alert ef-alert--danger" role="alert">{error}</p>}
      {!overview ? (
        !error && <p className="fr-status">Carregando...</p>
      ) : (
        <section className="fr-stack-lg">
          <div>
            <p className="ef-stat__label">Dinheiro que voltou para os negócios</p>
            <p className="ef-stat__value ef-stat__value--hero">{formatMoney(overview.totals.recoveredValue)}</p>
          </div>

          <div className="ef-stats">
            <Stat value={overview.totals.returnClients} label="negócios" />
            <Stat value={overview.totals.active} label="ativos" />
            <Stat value={overview.totals.endCustomers} label="clientes" />
            <Stat value={overview.totals.returned} label="voltaram" />
          </div>

          <div className="fr-spread">
            <h1 className="title-lg">Negócios</h1>
            <button type="button" className="ef-button ef-button--secondary ef-button--sm" onClick={() => setCreating(!creating)}>
              {creating ? 'Fechar' : 'Novo'}
            </button>
          </div>

          {creating && <NewClient onCreated={load} />}

          {overview.clients.map((client) => (
            <ClientCard key={client.id} client={client} onChanged={load} />
          ))}
        </section>
      )}
      </main>
    </>
  )
}

function ClientCard({ client, onChanged }: { client: ClientSummary; onChanged: () => Promise<void> }) {
  const [open, setOpen] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  async function patch(changes: Partial<{ plan: PlanId; status: AccountStatus; inactiveDays: number; dailyLimit: number }>) {
    setError('')
    try {
      await api(`/admin/clients/${client.id}`, { method: 'PATCH', body: changes })
      await onChanged()
    } catch {
      setError('Não foi possível salvar.')
    }
  }

  async function resetPassword() {
    setConfirming(false)
    setError('')
    try {
      const result = await api<{ temporaryPassword: string }>(`/admin/clients/${client.id}/reset-password`, {
        method: 'POST',
      })
      setPassword(result.temporaryPassword)
    } catch {
      setError('Não foi possível criar a senha.')
    }
  }

  const paused = client.status === 'pausado'

  return (
    <article className="ef-card">
      <div className="fr-spread">
        <div>
          <h2 className="title-md">{client.name}</h2>
          <p className="ef-item__meta">
            {client.segment} · Plano {PLANS[client.plan].name}
            {client.demo ? ' · Teste' : ''}
          </p>
        </div>
        <span className={paused ? 'ef-badge ef-badge--inverse' : 'ef-badge'}>{paused ? 'Pausado' : 'Ativo'}</span>
      </div>

      <div className="fr-figures">
        <Figure value={client.endCustomers} label="clientes" />
        <Figure value={client.contacted} label="chamados" />
        <Figure value={client.returned} label={client.returned === 1 ? 'voltou' : 'voltaram'} />
        <Figure value={formatMoney(client.recoveredValue)} label="recuperados" />
      </div>

      <p className="ef-item__meta">
        {client.ownerName} · {client.ownerEmail} · {formatLogin(client.lastLoginAt)}
      </p>

      <button type="button" className="ef-button ef-button--ghost ef-button--sm" aria-expanded={open} onClick={() => setOpen(!open)}>
        {open ? 'Fechar gestão' : 'Gerenciar'}
      </button>

      {open && (
        <div className="ef-stack">
          <label className="ef-field">
            <span className="ef-field__label">Plano</span>
            <select className="ef-input" value={client.plan} onChange={(event) => patch({ plan: event.target.value as PlanId })}>
              {Object.values(PLANS).map((plan) => (
                <option key={plan.id} value={plan.id}>
                  {plan.name} · R$ {plan.monthlyPrice}/mês
                </option>
              ))}
            </select>
          </label>

          <div className="ef-stats">
            <SmallNumber
              label="Sumido depois de (dias)"
              value={client.inactiveDays}
              onSave={(inactiveDays) => patch({ inactiveDays })}
            />
            <SmallNumber
              label="Limite por dia"
              value={client.dailyLimit}
              onSave={(dailyLimit) => patch({ dailyLimit })}
            />
          </div>

          <div className="ef-row">
            <button
              type="button"
              className="ef-button ef-button--secondary ef-button--sm"
              onClick={() => patch({ status: paused ? 'ativo' : 'pausado' })}
            >
              {paused ? 'Reativar conta' : 'Pausar conta'}
            </button>
            <button
              type="button"
              className="ef-button ef-button--secondary ef-button--sm"
              onClick={() => setConfirming(true)}
            >
              Nova senha
            </button>
          </div>

          {password && <TemporaryPassword password={password} />}
          {error && <p className="ef-alert ef-alert--danger" role="alert">{error}</p>}
        </div>
      )}

      {confirming && (
        <ConfirmDialog
          title="Criar nova senha?"
          text={`A senha atual de ${client.name} deixa de funcionar.`}
          confirmLabel="Criar nova senha"
          onConfirm={resetPassword}
          onClose={() => setConfirming(false)}
        />
      )}
    </article>
  )
}

function Figure({ value, label }: { value: number | string; label: string }) {
  return (
    <div>
      <p className="ef-stat__value">{value}</p>
      <p className="ef-stat__label">{label}</p>
    </div>
  )
}

function SmallNumber({ label, value, onSave }: { label: string; value: number; onSave: (value: number) => void }) {
  return (
    <label className="ef-field">
      <span className="ef-field__label">{label}</span>
      <input
        className="ef-input"
        key={value}
        type="number"
        min={1}
        defaultValue={value}
        onBlur={(event) => {
          const next = Number(event.target.value)
          if (Number.isInteger(next) && next >= 1 && next !== value) onSave(next)
        }}
      />
    </label>
  )
}

function TemporaryPassword({ password }: { password: string }) {
  return (
    <div className="ef-card ef-card--panel">
      <p className="label">Senha temporária</p>
      <p className="number-md fr-break">{password}</p>
      <p className="ef-field__hint">Copie agora. Ela não aparece de novo.</p>
    </div>
  )
}

function NewClient({ onCreated }: { onCreated: () => Promise<void> }) {
  const [form, setForm] = useState({ name: '', segment: '', ownerName: '', ownerEmail: '', plan: 'basico' as PlanId })
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  const set = (key: keyof typeof form) => (event: { target: { value: string } }) =>
    setForm({ ...form, [key]: event.target.value })

  async function submit(event: FormEvent) {
    event.preventDefault()
    setError('')
    try {
      const result = await api<{ temporaryPassword: string }>('/admin/clients', { body: form })
      setPassword(result.temporaryPassword)
      await onCreated()
    } catch (failure) {
      setError(
        failure instanceof ApiError && failure.code === 'email_em_uso'
          ? 'Esse e-mail já está em uso.'
          : 'Confira os dados e tente de novo.',
      )
    }
  }

  if (password) return <TemporaryPassword password={password} />

  return (
    <form className="ef-card" onSubmit={submit}>
      <h2 className="title-md">Novo negócio</h2>
      <label className="ef-field">
        <span className="ef-field__label">Nome do negócio</span>
        <input className="ef-input" required value={form.name} onChange={set('name')} />
      </label>
      <label className="ef-field">
        <span className="ef-field__label">Segmento</span>
        <input className="ef-input" required value={form.segment} onChange={set('segment')} />
      </label>
      <label className="ef-field">
        <span className="ef-field__label">Nome do dono</span>
        <input className="ef-input" required value={form.ownerName} onChange={set('ownerName')} />
      </label>
      <label className="ef-field">
        <span className="ef-field__label">E-mail de acesso</span>
        <input className="ef-input" required type="email" value={form.ownerEmail} onChange={set('ownerEmail')} />
      </label>
      <label className="ef-field">
        <span className="ef-field__label">Plano</span>
        <select className="ef-input" value={form.plan} onChange={set('plan')}>
          {Object.values(PLANS).map((plan) => (
            <option key={plan.id} value={plan.id}>
              {plan.name}
            </option>
          ))}
        </select>
      </label>
      {error && <p className="ef-alert ef-alert--danger" role="alert">{error}</p>}
      <button type="submit" className="ef-button ef-button--brand ef-button--full">
        Criar conta
      </button>
    </form>
  )
}
