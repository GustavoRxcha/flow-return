import { useEffect, useState } from 'react'
import { monthLabel } from '../lib/agenda'
import { api } from '../lib/api'
import type { Metrics } from '../lib/endCustomers'
import { formatMoney } from '../lib/format'
import type { Appointment, Professional } from '../lib/types'
import type { AgendaTarget } from './Agenda'
import { MonthGrid } from './CalendarViews'
import { FinancePanel } from './FinancePanel'
import { usePreferences } from './Preferences'

const MAX_TODAY = 5

interface Props {
  metrics: Metrics
  today: string
  onStart: () => void
  onOpenAgenda: (target: AgendaTarget) => void
  onFailure: (failure: unknown) => void
}

export function Home({ metrics, today, onStart, onOpenAgenda, onFailure }: Props) {
  const { returned, recoveredValue, inQueue, waiting, leftToday } = metrics
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [professionals, setProfessionals] = useState<Professional[]>([])
  const several = professionals.length > 1
  const { locale, t, tp } = usePreferences()

  useEffect(() => {
    api<{ appointments: Appointment[]; professionals: Professional[] }>('/workspace/agenda')
      .then((data) => {
        setAppointments(data.appointments)
        setProfessionals(data.professionals)
      })
      .catch(onFailure)
  }, [onFailure])

  const todayItems = appointments.filter((item) => item.date === today)

  return (
    <div className="fr-home">
      <div className="fr-stack-lg">
        <div className="fr-home__boxes">
          <section className="ef-card ef-card--panel">
            <div className="fr-spread">
              <h2 className="ef-stat__label">{t('home.whatsappTitle')}</h2>
              <span className="ef-badge">{t('common.soon')}</span>
            </div>
            <p className="ef-stat__value">0</p>
            <p className="ef-stat__note">{t('home.whatsappNote')}</p>
          </section>

          <section className="ef-card ef-card--panel">
            <h2 className="ef-stat__label">{t('home.lostTitle')}</h2>
            <p className="ef-stat__value">{inQueue}</p>
            <p className="ef-stat__note">
              {t('home.waiting', { n: waiting })} · {tp('home.returned', returned)}
              {recoveredValue > 0 && ` · ${t('home.recovered', { value: formatMoney(recoveredValue) })}`}
            </p>
            {inQueue > 0 && leftToday > 0 && (
              <button type="button" className="ef-button ef-button--primary ef-button--sm" onClick={onStart}>
                {t('home.seeCustomers')}
              </button>
            )}
          </section>
        </div>

        <FinancePanel appointments={appointments} professionals={professionals} today={today} />
      </div>

      <section className="fr-stack-lg" aria-label={t('home.agendaSummary')}>
        <div className="ef-stack">
          <div className="fr-cal-bar">
            <h2 className="title-md">{monthLabel(today, locale)}</h2>
            <button
              type="button"
              className="ef-button ef-button--ghost ef-button--sm"
              onClick={() => onOpenAgenda({ view: 'mes' })}
            >
              {t('home.openAgenda')}
            </button>
          </div>
          <MonthGrid
            date={today}
            today={today}
            appointments={appointments}
            onDay={(date) => onOpenAgenda({ date, view: 'dia' })}
          />
        </div>

        <div>
          <h2 className="title-md">{t('home.todayTitle')}</h2>
          {todayItems.length === 0 ? (
            <p className="ef-card__text">{t('home.noneToday')}</p>
          ) : (
            <ul className="ef-list">
              {todayItems.slice(0, MAX_TODAY).map((item) => (
                <li key={item.id} className="ef-item">
                  <span className="ef-item__body">
                    <span className="ef-item__title">{item.customerName}</span>
                    <span className="ef-item__meta">
                      {item.time} · {item.service}
                      {several && ` · ${item.professionalName}`}
                    </span>
                  </span>
                </li>
              ))}
              <li className="ef-item">
                <button
                  type="button"
                  className="ef-button ef-button--ghost ef-button--sm ef-button--full"
                  onClick={() => onOpenAgenda({ date: today, view: 'dia' })}
                >
                  {t('home.seeAll')}
                </button>
              </li>
            </ul>
          )}
        </div>
      </section>
    </div>
  )
}
