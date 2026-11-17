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
import { usePreferences } from './Preferences'
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
  const { tp } = usePreferences()
  return <span className={ABSENCE_BADGES[absenceTone(days)]}>{tp('customers.days', days)}</span>
}

const DEFAULT_FILTERS = { search: '', next: 'todos' as NextFilter, sort: 'ultimo-antigo' as RosterSort }

export function EndCustomers({ state, metrics, today, dispatch, onFailure }: Props) {
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [filters, setFilters] = useState(DEFAULT_FILTERS)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [contact, setContact] = useState<string | null>(null)
  const [recipients, setRecipients] = useState<RosterRow[] | null>(null)
  const { t } = usePreferences()

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
          <h1 className="title-lg">{t('customers.title')}</h1>
          <p className="ef-stat__note">
            {t('customers.count', { shown: rows.length, total: roster.length, sent: metrics.sentToday, limit: state.settings.dailyLimit })}
          </p>
        </div>
        {selected.size > 0 && (
          <button type="button" className="ef-button ef-button--primary ef-button--sm" onClick={openBulk}>
            {t('customers.sendTo', { n: selected.size })}
          </button>
        )}
      </div>

      <div className="fr-filters">
        <label className="ef-field">
          <span className="ef-field__label">{t('customers.search')}</span>
          <input
            className="ef-input"
            inputMode="search"
            placeholder={t('customers.searchPlaceholder')}
            value={filters.search}
            onChange={(event) => setFilters({ ...filters, search: event.target.value })}
          />
        </label>
        <label className="ef-field">
          <span className="ef-field__label">{t('customers.next')}</span>
          <select
            className="ef-input"
            value={filters.next}
            onChange={(event) => setFilters({ ...filters, next: event.target.value as NextFilter })}
          >
            <option value="todos">{t('common.all')}</option>
            <option value="sem">{t('customers.notBooked')}</option>
            <option value="com">{t('customers.booked')}</option>
          </select>
        </label>
        <label className="ef-field">
          <span className="ef-field__label">{t('customers.sortBy')}</span>
          <select
            className="ef-input"
            value={filters.sort}
            onChange={(event) => setFilters({ ...filters, sort: event.target.value as RosterSort })}
          >
            {(Object.keys(ROSTER_SORTS) as RosterSort[]).map((value) => (
              <option key={value} value={value}>
                {t(`customers.sort.${value}`)}
              </option>
            ))}
          </select>
        </label>
      </div>

      {rows.length === 0 ? (
        <Empty
          title={t('customers.emptyTitle')}
          text={t('customers.emptyText')}
          action={{ label: t('customers.clearFilters'), onClick: () => setFilters(DEFAULT_FILTERS) }}
        />
      ) : (
        <>
        <div className="ef-tablewrap fr-only-wide">
          <table className="ef-table">
            <thead>
              <tr>
                <th>
                  <input
                    type="checkbox"
                    className="ef-check"
                    aria-label={t('customers.selectAll')}
                    checked={allSelected}
                    onChange={toggleAll}
                  />
                </th>
                <th>{t('customers.name')}</th>
                <th>{t('customers.phone')}</th>
                <th>{t('customers.lastVisit')}</th>
                <th>{t('customers.daysAway')}</th>
                <th>{t('customers.next')}</th>
                <th>{t('customers.contact')}</th>
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
                        aria-label={t('customers.select', { name: customer.name })}
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
                        t('common.dateAt', { date: formatDate(next.date), time: next.time })
                      ) : (
                        <span className="ef-badge ef-badge--danger">{t('customers.notBooked')}</span>
                      )}
                    </td>
                    <td>
                      <button
                        type="button"
                        className="ef-button ef-button--secondary ef-button--sm"
                        aria-label={t('customers.contactOf', { name: customer.name })}
                        onClick={() => setContact(customer.phone)}
                      >
                        {blocked ? t('customers.doNotCall') : t('customers.contact')}
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <div className="fr-only-narrow">
          <label className="ef-choice">
            <input type="checkbox" className="ef-check" checked={allSelected} onChange={toggleAll} />
            {t('customers.selectAll')}
          </label>
        </div>
        <ul className="ef-list fr-only-narrow">
          {rows.map((row) => {
            const { customer, next, lastVisit } = row
            const blocked = customer.status === 'nao_chamar'
            return (
              <li key={customer.phone} className="ef-item fr-person">
                <input
                  type="checkbox"
                  className="ef-check"
                  aria-label={t('customers.select', { name: customer.name })}
                  disabled={blocked}
                  checked={selected.has(customer.phone)}
                  onChange={() => toggle(customer.phone)}
                />
                <button type="button" className="fr-person__open" aria-label={t('customers.contactOf', { name: customer.name })} onClick={() => setContact(customer.phone)}>
                  <span className="ef-item__body">
                    <span className="ef-item__title">{customer.name}</span>
                    <span className="ef-item__meta">
                      {formatBrPhone(customer.phone)} · {t('customers.lastShort', { date: formatDate(lastVisit) })}
                    </span>
                    <span className="fr-person__next">
                      {blocked ? (
                        <span className="ef-badge">{t('customers.doNotCall')}</span>
                      ) : next ? (
                        <span className="ef-item__meta">{t('customers.nextShort', { when: t('common.dateAt', { date: formatDate(next.date), time: next.time }) })}</span>
                      ) : (
                        <span className="ef-badge ef-badge--danger">{t('customers.notBooked')}</span>
                      )}
                    </span>
                  </span>
                  <AbsenceBadge days={daysBetween(lastVisit, today)} />
                </button>
              </li>
            )
          })}
        </ul>
        </>
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
