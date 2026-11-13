import { useEffect, useState } from 'react'
import { monthLabel } from '../lib/agenda'
import { api } from '../lib/api'
import type { Metrics } from '../lib/endCustomers'
import { formatMoney } from '../lib/format'
import type { Appointment, Professional } from '../lib/types'
import type { AgendaTarget } from './Agenda'
import { MonthGrid } from './CalendarViews'
import { FinancePanel } from './FinancePanel'

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
              <h2 className="ef-stat__label">Agendamentos via WhatsApp</h2>
              <span className="ef-badge">Em breve</span>
            </div>
            <p className="ef-stat__value">0</p>
            <p className="ef-stat__note">Quem marcar pelo WhatsApp vai aparecer aqui.</p>
          </section>

          <section className="ef-card ef-card--panel">
            <h2 className="ef-stat__label">Clientes sumidos</h2>
            <p className="ef-stat__value">{inQueue}</p>
            <p className="ef-stat__note">
              {waiting} aguardando retorno · {returned} {returned === 1 ? 'voltou' : 'voltaram'}
              {recoveredValue > 0 && ` · ${formatMoney(recoveredValue)} de volta`}
            </p>
            {inQueue > 0 && leftToday > 0 && (
              <button type="button" className="ef-button ef-button--primary ef-button--sm" onClick={onStart}>
                Ver clientes
              </button>
            )}
          </section>
        </div>

        <FinancePanel appointments={appointments} professionals={professionals} today={today} />
      </div>

      <section className="fr-stack-lg" aria-label="Resumo da agenda">
        <div className="ef-stack">
          <div className="fr-cal-bar">
            <h2 className="title-md">{monthLabel(today)}</h2>
            <button
              type="button"
              className="ef-button ef-button--ghost ef-button--sm"
              onClick={() => onOpenAgenda({ view: 'mes' })}
            >
              Abrir agenda
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
          <h2 className="title-md">Clientes de hoje</h2>
          {todayItems.length === 0 ? (
            <p className="ef-card__text">Nenhum horário marcado para hoje.</p>
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
                  Ver todos os clientes
                </button>
              </li>
            </ul>
          )}
        </div>
      </section>
    </div>
  )
}
