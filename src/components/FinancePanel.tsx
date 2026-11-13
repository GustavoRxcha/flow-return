import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useState } from 'react'
import { monthLabel, shiftMonth } from '../lib/agenda'
import { monthFinance } from '../lib/finance'
import { formatCents } from '../lib/format'
import type { Appointment, Professional } from '../lib/types'
import { Stat } from './Stat'

interface Props {
  appointments: Appointment[]
  professionals: Professional[]
  today: string
}

function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`
}

function currentTime(): string {
  const now = new Date()
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
}

export function FinancePanel({ appointments, professionals, today }: Props) {
  const [date, setDate] = useState(today)
  const finance = monthFinance(appointments, professionals, date.slice(0, 7), { date: today, time: currentTime() })
  const shift = (amount: number) => setDate(shiftMonth(date, amount, today))

  return (
    <section className="ef-card" aria-label="Financeiro do mês">
      <div className="fr-cal-bar">
        <h2 className="title-md">Financeiro</h2>
        <div className="ef-row">
          <button
            type="button"
            className="ef-button ef-button--ghost ef-button--sm fr-cal-arrow"
            aria-label="Mês anterior"
            onClick={() => shift(-1)}
          >
            <ChevronLeft size={20} strokeWidth={2} aria-hidden="true" />
          </button>
          <span className="label" aria-live="polite">{monthLabel(date)}</span>
          <button
            type="button"
            className="ef-button ef-button--ghost ef-button--sm fr-cal-arrow"
            aria-label="Próximo mês"
            onClick={() => shift(1)}
          >
            <ChevronRight size={20} strokeWidth={2} aria-hidden="true" />
          </button>
        </div>
      </div>

      <div className="ef-stats">
        <Stat result value={formatCents(finance.receivedCents)} label="recebido" />
        <Stat value={formatCents(finance.expectedCents)} label="ainda vai entrar" />
        <Stat
          value={finance.averageCents === null ? '-' : formatCents(finance.averageCents)}
          label="ticket médio"
        />
      </div>

      <div className="fr-home__boxes">
        <div>
          <h3 className="label">Atendimentos por profissional</h3>
          <ul className="ef-list">
            {finance.byProfessional.map((item) => (
              <li key={item.id} className="ef-item">
                <span className="ef-item__body">
                  <span className="ef-item__title">{item.name}</span>
                  <span className="ef-item__meta">{plural(item.attended, 'atendimento', 'atendimentos')}</span>
                </span>
                <span className="label fr-nowrap">{formatCents(item.cents)}</span>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h3 className="label">Serviços mais agendados</h3>
          {finance.topServices.length === 0 ? (
            <p className="ef-card__text">Nenhum horário neste mês.</p>
          ) : (
            <ul className="ef-list">
              {finance.topServices.map((item) => (
                <li key={item.name} className="ef-item">
                  <span className="ef-item__body">
                    <span className="ef-item__title">{item.name}</span>
                  </span>
                  <span className="label fr-nowrap">{plural(item.count, 'horário', 'horários')}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <p className="ef-field__hint">
        Recebido conta os horários que já terminaram.
        {finance.withoutPrice > 0 &&
          ` ${plural(finance.withoutPrice, 'horário', 'horários')} sem valor ${finance.withoutPrice === 1 ? 'fica' : 'ficam'} de fora.`}
      </p>
    </section>
  )
}
