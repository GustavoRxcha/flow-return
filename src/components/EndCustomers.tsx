import { useEffect, useMemo, useState } from 'react'
import { api } from '../lib/api'
import { daysBetween, formatDate } from '../lib/dates'
import type { Metrics } from '../lib/endCustomers'
import { formatBrPhone } from '../lib/phone'
import { absenceTone, buildRoster, filterRoster, ROSTER_SORTS } from '../lib/roster'
import type { NextFilter, RosterRow, RosterSort } from '../lib/roster'
import type { Appointment, AppState } from '../lib/types'
import { ContactDialog } from './ContactDialog'
import { Empty } from './Empty'
import { MessageComposer } from './MessageComposer'
import type { Dispatch } from './ReturnClientApp'

interface Props {
  state: AppState
  metrics: Metrics
  today: string
  dispatch: Dispatch
  onFailure: (failure: unknown) => void
}

const ABSENCE_BADGES = {
  recente: 'ef-badge ef-badge--success',
  atencao: 'ef-badge fr-badge--warning',
  distante: 'ef-badge ef-badge--danger',
}

function AbsenceBadge({ days }: { days: number }) {
  return <span className={ABSENCE_BADGES[absenceTone(days)]}>{days === 1 ? '1 dia' : `${days} dias`}</span>
}

const DEFAULT_FILTERS = { search: '', next: 'todos' as NextFilter, sort: 'ultimo-antigo' as RosterSort }

export function EndCustomers({ state, metrics, today, dispatch, onFailure }: Props) {
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [filters, setFilters] = useState(DEFAULT_FILTERS)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [contact, setContact] = useState<string | null>(null)
  const [recipients, setRecipients] = useState<RosterRow[] | null>(null)

  useEffect(() => {
    api<{ appointments: Appointment[] }>('/workspace/agenda')
      .then((data) => setAppointments(data.appointments))
      .catch(onFailure)
  }, [onFailure])

  const roster = useMemo(() => buildRoster(state.customers, appointments, today), [state.customers, appointments, today])
  const rows = useMemo(() => filterRoster(roster, filters), [roster, filters])
  const callable = rows.filter((row) => row.customer.status !== 'nao_chamar')
  const allSelected = callable.length > 0 && callable.every((row) => selected.has(row.customer.phone))
  const contactRow = roster.find((row) => row.customer.phone === contact)

  function toggle(phone: string) {
    const next = new Set(selected)
    if (!next.delete(phone)) next.add(phone)
    setSelected(next)
  }

  function toggleAll() {
    const next = new Set(selected)
    for (const row of callable) {
      if (allSelected) next.delete(row.customer.phone)
      else next.add(row.customer.phone)
    }
    setSelected(next)
  }

  function openBulk() {
    setRecipients(roster.filter((row) => selected.has(row.customer.phone) && row.customer.status !== 'nao_chamar'))
  }

  return (
    <section className="ef-stack">
      <div className="fr-spread">
        <div>
          <h1 className="title-lg">Clientes</h1>
          <p className="ef-stat__note">
            {rows.length} de {roster.length} · Hoje: {metrics.sentToday} de {state.settings.dailyLimit} mensagens
          </p>
        </div>
        {selected.size > 0 && (
          <button type="button" className="ef-button ef-button--primary ef-button--sm" onClick={openBulk}>
            Enviar para {selected.size}
          </button>
        )}
      </div>

      <div className="fr-filters">
        <label className="ef-field">
          <span className="ef-field__label">Buscar</span>
          <input
            className="ef-input"
            inputMode="search"
            placeholder="Nome ou telefone"
            value={filters.search}
            onChange={(event) => setFilters({ ...filters, search: event.target.value })}
          />
        </label>
        <label className="ef-field">
          <span className="ef-field__label">Próximo atendimento</span>
          <select
            className="ef-input"
            value={filters.next}
            onChange={(event) => setFilters({ ...filters, next: event.target.value as NextFilter })}
          >
            <option value="todos">Todos</option>
            <option value="sem">Não marcado</option>
            <option value="com">Marcado</option>
          </select>
        </label>
        <label className="ef-field">
          <span className="ef-field__label">Ordenar por</span>
          <select
            className="ef-input"
            value={filters.sort}
            onChange={(event) => setFilters({ ...filters, sort: event.target.value as RosterSort })}
          >
            {Object.entries(ROSTER_SORTS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {rows.length === 0 ? (
        <Empty
          title="Ninguém com esses filtros."
          text="Mude a busca para ver outros clientes."
          action={{ label: 'Limpar filtros', onClick: () => setFilters(DEFAULT_FILTERS) }}
        />
      ) : (
        <div className="ef-tablewrap">
          <table className="ef-table">
            <thead>
              <tr>
                <th>
                  <input
                    type="checkbox"
                    className="ef-check"
                    aria-label="Selecionar todos da lista"
                    checked={allSelected}
                    onChange={toggleAll}
                  />
                </th>
                <th>Nome</th>
                <th>Telefone</th>
                <th>Último atendimento</th>
                <th>Dias sem vir</th>
                <th>Próximo atendimento</th>
                <th>Contato</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const { customer, next, lastVisit } = row
                const blocked = customer.status === 'nao_chamar'
                return (
                  <tr key={customer.phone}>
                    <td>
                      <input
                        type="checkbox"
                        className="ef-check"
                        aria-label={`Selecionar ${customer.name}`}
                        disabled={blocked}
                        checked={selected.has(customer.phone)}
                        onChange={() => toggle(customer.phone)}
                      />
                    </td>
                    <td className="fr-nowrap">{customer.name}</td>
                    <td className="fr-nowrap">{formatBrPhone(customer.phone)}</td>
                    <td className="fr-nowrap">{formatDate(lastVisit)}</td>
                    <td>
                      <AbsenceBadge days={daysBetween(lastVisit, today)} />
                    </td>
                    <td className="fr-nowrap">
                      {next ? (
                        `${formatDate(next.date)} às ${next.time}`
                      ) : (
                        <span className="ef-badge ef-badge--danger">Não marcado</span>
                      )}
                    </td>
                    <td>
                      <button
                        type="button"
                        className="ef-button ef-button--secondary ef-button--sm"
                        aria-label={`Contato de ${customer.name}`}
                        onClick={() => setContact(customer.phone)}
                      >
                        {blocked ? 'Não chamar' : 'Contato'}
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {contactRow && (
        <ContactDialog
          row={contactRow}
          demo={state.demo}
          dispatch={dispatch}
          onReminder={() => {
            setContact(null)
            setRecipients([contactRow])
          }}
          onClose={() => setContact(null)}
        />
      )}

      {recipients && (
        <MessageComposer
          recipients={recipients}
          settings={state.settings}
          today={today}
          demo={state.demo}
          leftToday={metrics.leftToday}
          dispatch={dispatch}
          onClose={(finished) => {
            setRecipients(null)
            if (finished) setSelected(new Set())
          }}
        />
      )}
    </section>
  )
}
