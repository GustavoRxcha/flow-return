import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useState } from 'react'
import { monthLabel, shiftMonth } from '../lib/agenda'
import { monthFinance } from '../lib/finance'
import { formatCents } from '../lib/format'
import type { Appointment, Professional } from '../lib/types'
import { usePreferences } from './Preferences'
import { Stat } from './Stat'

interface Props {
  appointments: Appointment[]
  professionals: Professional[]
  today: string
}

function currentTime(): string {
  const now = new Date()
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
}

export function FinancePanel({ appointments, professionals, today }: Props) {
  const [date, setDate] = useState(today)
  const { locale, t, tp } = usePreferences()
  const finance = monthFinance(appointments, professionals, date.slice(0, 7), { date: today, time: currentTime() })
  const shift = (amount: number) => setDate(shiftMonth(date, amount, today))

  return (
    <section className="ef-card" aria-label={t('finance.aria')}>
      <div className="fr-cal-bar">
        <h2 className="title-md">{t('finance.title')}</h2>
        <div className="ef-row">
          <button
            type="button"
            className="ef-button ef-button--ghost ef-button--sm fr-cal-arrow"
            aria-label={t('finance.previous')}
            onClick={() => shift(-1)}
          >
            <ChevronLeft size={20} strokeWidth={2} aria-hidden="true" />
          </button>
          <span className="label" aria-live="polite">{monthLabel(date, locale)}</span>
          <button
            type="button"
            className="ef-button ef-button--ghost ef-button--sm fr-cal-arrow"
            aria-label={t('finance.next')}
            onClick={() => shift(1)}
          >
            <ChevronRight size={20} strokeWidth={2} aria-hidden="true" />
          </button>
        </div>
      </div>

      <div className="ef-stats">
        <Stat result value={formatCents(finance.receivedCents)} label={t('finance.received')} />
        <Stat value={formatCents(finance.expectedCents)} label={t('finance.expected')} />
        <Stat
          value={finance.averageCents === null ? '-' : formatCents(finance.averageCents)}
          label={t('finance.average')}
        />
      </div>

      <div className="fr-home__boxes">
        <div>
          <h3 className="label">{t('finance.byProfessional')}</h3>
          <ul className="ef-list">
            {finance.byProfessional.map((item) => (
              <li key={item.id} className="ef-item">
                <span className="ef-item__body">
                  <span className="ef-item__title">{item.name}</span>
                  <span className="ef-item__meta">{tp('finance.attended', item.attended)}</span>
                </span>
                <span className="label fr-nowrap">{formatCents(item.cents)}</span>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h3 className="label">{t('finance.topServices')}</h3>
          {finance.topServices.length === 0 ? (
            <p className="ef-card__text">{t('finance.noneMonth')}</p>
          ) : (
            <ul className="ef-list">
              {finance.topServices.map((item) => (
                <li key={item.name} className="ef-item">
                  <span className="ef-item__body">
                    <span className="ef-item__title">{item.name}</span>
                  </span>
                  <span className="label fr-nowrap">{tp('finance.slots', item.count)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <p className="ef-field__hint">
        {t('finance.hint')}
        {finance.withoutPrice > 0 && ` ${tp('finance.withoutPrice', finance.withoutPrice)}`}
      </p>
    </section>
  )
}
