import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { api, ApiError } from '../lib/api'
import { formatMoney } from '../lib/format'
import { PLANS } from '../lib/plans'
import type { AccountStatus, PlanId, ReturnClient, SessionUser } from '../lib/types'
import { ConfirmDialog } from './ConfirmDialog'
import { Header } from './Header'
import { usePreferences } from './Preferences'
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

function LastLogin({ iso }: { iso: string | null }) {
  const { t, intl } = usePreferences()
  if (!iso) return <>{t('gestor.neverLogged')}</>
  return <>{t('gestor.lastLogin', { date: new Date(iso).toLocaleDateString(intl) })}</>
}

export function GestorApp({ user, onLogout }: { user: SessionUser; onLogout: () => void }) {
  const [overview, setOverview] = useState<Overview | null>(null)
  const [error, setError] = useState('')
  const [creating, setCreating] = useState(false)
  const { t } = usePreferences()

  const load = useCallback(async () => {
    try {
      setOverview(await api<Overview>('/admin/overview'))
      setError('')
    } catch {
      setError('loadFailed')
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <>
      <Header subtitle={t('gestor.subtitle', { name: user.name })} onLogout={onLogout} />
      <main className="fr-page fr-page--wide fr-page--solo">
      {error && <p className="ef-alert ef-alert--danger" role="alert">{t('gestor.loadFailed')}</p>}
      {!overview ? (
        !error && <p className="fr-status">{t('common.loading')}</p>
      ) : (
        <section className="fr-stack-lg">
          <div>
            <p className="ef-stat__label">{t('gestor.moneyBack')}</p>
            <p className="ef-stat__value ef-stat__value--hero">{formatMoney(overview.totals.recoveredValue)}</p>
          </div>

          <div className="ef-stats">
            <Stat value={overview.totals.returnClients} label={t('gestor.statBusinesses')} />
            <Stat value={overview.totals.active} label={t('gestor.statActive')} />
            <Stat value={overview.totals.endCustomers} label={t('gestor.statCustomers')} />
            <Stat value={overview.totals.returned} label={t('gestor.statReturned')} />
          </div>

          <div className="fr-spread">
            <h1 className="title-lg">{t('gestor.businesses')}</h1>
            <button type="button" className="ef-button ef-button--secondary ef-button--sm" onClick={() => setCreating(!creating)}>
              {creating ? t('common.close') : t('gestor.new')}
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
  const { t, tp } = usePreferences()

  async function patch(changes: Partial<{ plan: PlanId; status: AccountStatus; inactiveDays: number; dailyLimit: number }>) {
    setError('')
    try {
      await api(`/admin/clients/${client.id}`, { method: 'PATCH', body: changes })
      await onChanged()
    } catch {
      setError(t('gestor.saveFailed'))
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
      setError(t('gestor.passwordFailed'))
    }
  }

  const paused = client.status === 'pausado'

  return (
    <article className="ef-card">
      <div className="fr-spread">
        <div>
          <h2 className="title-md">{client.name}</h2>
          <p className="ef-item__meta">
            {client.segment} · {t('gestor.planOf', { name: t(`plan.${client.plan}`) })}
            {client.demo ? ` · ${t('gestor.demo')}` : ''}
          </p>
        </div>
        <span className={paused ? 'ef-badge ef-badge--inverse' : 'ef-badge'}>{paused ? t('gestor.paused') : t('gestor.active')}</span>
      </div>

      <div className="fr-figures">
        <Figure value={client.endCustomers} label={t('gestor.figureCustomers')} />
        <Figure value={client.contacted} label={t('gestor.figureCalled')} />
        <Figure value={client.returned} label={tp('gestor.figureReturned', client.returned)} />
        <Figure value={formatMoney(client.recoveredValue)} label={t('gestor.figureRecovered')} />
      </div>

      <p className="ef-item__meta">
        {client.ownerName} · {client.ownerEmail} · <LastLogin iso={client.lastLoginAt} />
      </p>

      <button type="button" className="ef-button ef-button--ghost ef-button--sm" aria-expanded={open} onClick={() => setOpen(!open)}>
        {open ? t('gestor.closeManage') : t('gestor.manage')}
      </button>

      {open && (
        <div className="ef-stack">
          <label className="ef-field">
            <span className="ef-field__label">{t('gestor.plan')}</span>
            <select className="ef-input" value={client.plan} onChange={(event) => patch({ plan: event.target.value as PlanId })}>
              {Object.values(PLANS).map((plan) => (
                <option key={plan.id} value={plan.id}>
                  {t('plan.perMonth', { name: t(`plan.${plan.id}`), price: plan.monthlyPrice })}
                </option>
              ))}
            </select>
          </label>

          <div className="ef-stats">
            <SmallNumber
              label={t('settings.inactiveDays')}
              value={client.inactiveDays}
              onSave={(inactiveDays) => patch({ inactiveDays })}
            />
            <SmallNumber
              label={t('settings.dailyLimit')}
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
              {paused ? t('gestor.reactivate') : t('gestor.pause')}
            </button>
            <button
              type="button"
              className="ef-button ef-button--secondary ef-button--sm"
              onClick={() => setConfirming(true)}
            >
              {t('gestor.newPassword')}
            </button>
          </div>

          {password && <TemporaryPassword password={password} />}
          {error && <p className="ef-alert ef-alert--danger" role="alert">{error}</p>}
        </div>
      )}

      {confirming && (
        <ConfirmDialog
          title={t('gestor.passwordTitle')}
          text={t('gestor.passwordText', { name: client.name })}
          confirmLabel={t('gestor.passwordConfirm')}
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
  const { t } = usePreferences()
  return (
    <div className="ef-card ef-card--panel">
      <p className="label">{t('gestor.tempPassword')}</p>
      <p className="number-md fr-break">{password}</p>
      <p className="ef-field__hint">{t('gestor.tempHint')}</p>
    </div>
  )
}

function NewClient({ onCreated }: { onCreated: () => Promise<void> }) {
  const [form, setForm] = useState({ name: '', segment: '', ownerName: '', ownerEmail: '', plan: 'basico' as PlanId })
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const { t } = usePreferences()

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
          ? t('gestor.emailInUse')
          : t('gestor.checkData'),
      )
    }
  }

  if (password) return <TemporaryPassword password={password} />

  return (
    <form className="ef-card" onSubmit={submit}>
      <h2 className="title-md">{t('gestor.newBusiness')}</h2>
      <label className="ef-field">
        <span className="ef-field__label">{t('gestor.businessName')}</span>
        <input className="ef-input" required value={form.name} onChange={set('name')} />
      </label>
      <label className="ef-field">
        <span className="ef-field__label">{t('gestor.segment')}</span>
        <input className="ef-input" required value={form.segment} onChange={set('segment')} />
      </label>
      <label className="ef-field">
        <span className="ef-field__label">{t('gestor.ownerName')}</span>
        <input className="ef-input" required value={form.ownerName} onChange={set('ownerName')} />
      </label>
      <label className="ef-field">
        <span className="ef-field__label">{t('gestor.ownerEmail')}</span>
        <input className="ef-input" required type="email" value={form.ownerEmail} onChange={set('ownerEmail')} />
      </label>
      <label className="ef-field">
        <span className="ef-field__label">{t('gestor.plan')}</span>
        <select className="ef-input" value={form.plan} onChange={set('plan')}>
          {Object.values(PLANS).map((plan) => (
            <option key={plan.id} value={plan.id}>
              {t(`plan.${plan.id}`)}
            </option>
          ))}
        </select>
      </label>
      {error && <p className="ef-alert ef-alert--danger" role="alert">{error}</p>}
      <button type="submit" className="ef-button ef-button--brand ef-button--full">
        {t('gestor.create')}
      </button>
    </form>
  )
}
