import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useEffect, useState, type CSSProperties } from 'react'
import { appointmentEnd, dayHours, dayLabel, layoutDay, monthLabel, monthWeeks, weekDays } from '../lib/agenda'
import type { Appointment } from '../lib/types'

const WEEKDAY_LETTERS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S']

interface ToolbarProps {
  date: string
  view: 'mes' | 'dia'
  onPrevious: () => void
  onNext: () => void
  onToday: () => void
  onView: (view: 'mes' | 'dia') => void
  onNew: () => void
}

export function CalendarToolbar({ date, view, onPrevious, onNext, onToday, onView, onNew }: ToolbarProps) {
  const unit = view === 'mes' ? 'Mês' : 'Dia'
  return (
    <div className="ef-stack">
      <div className="fr-cal-bar">
        <h1 className="title-lg" aria-live="polite">{monthLabel(date)}</h1>
        <div className="ef-row">
          <button
            type="button"
            className="ef-button ef-button--ghost ef-button--sm fr-cal-arrow"
            aria-label={`${unit} anterior`}
            onClick={onPrevious}
          >
            <ChevronLeft size={20} strokeWidth={2} aria-hidden="true" />
          </button>
          <button type="button" className="ef-button ef-button--ghost ef-button--sm" onClick={onToday}>
            Hoje
          </button>
          <button
            type="button"
            className="ef-button ef-button--ghost ef-button--sm fr-cal-arrow"
            aria-label={`Próximo ${unit.toLowerCase()}`}
            onClick={onNext}
          >
            <ChevronRight size={20} strokeWidth={2} aria-hidden="true" />
          </button>
        </div>
      </div>
      <div className="fr-cal-bar">
        <div className="ef-tabs" role="tablist" aria-label="Visão">
          <button type="button" className="ef-tab" role="tab" aria-selected={view === 'mes'} onClick={() => onView('mes')}>
            Mês
          </button>
          <button type="button" className="ef-tab" role="tab" aria-selected={view === 'dia'} onClick={() => onView('dia')}>
            Dia
          </button>
        </div>
        <button type="button" className="ef-button ef-button--primary ef-button--sm" onClick={onNew}>
          Novo horário
        </button>
      </div>
    </div>
  )
}

function WeekdayNames() {
  return (
    <div className="fr-cal-week fr-cal-names caption" aria-hidden="true">
      {WEEKDAY_LETTERS.map((letter, index) => (
        <span key={index}>{letter}</span>
      ))}
    </div>
  )
}

interface DayCellProps {
  date: string
  selected: boolean
  today: string
  count: number
  onClick: () => void
}

function DayCell({ date, selected, today, count, onClick }: DayCellProps) {
  const number = Number(date.slice(8))
  const summary = count === 0 ? 'sem horários' : count === 1 ? '1 horário' : `${count} horários`
  return (
    <button
      type="button"
      className="fr-cal-day"
      aria-label={`${dayLabel(date, today)}, ${summary}`}
      aria-pressed={selected}
      aria-current={date === today ? 'date' : undefined}
      onClick={onClick}
    >
      <span className="fr-cal-number label">{number}</span>
      <span className={count > 0 ? 'fr-cal-dot fr-cal-dot--on' : 'fr-cal-dot'} />
    </button>
  )
}

function countByDay(appointments: Appointment[]): Map<string, number> {
  const counts = new Map<string, number>()
  for (const { date } of appointments) counts.set(date, (counts.get(date) ?? 0) + 1)
  return counts
}

function EventButton({
  item,
  past,
  placement,
  showProfessional,
  onOpen,
}: {
  item: Appointment
  past: boolean
  showProfessional: boolean
  placement?: { start: number; length: number; column: number; columns: number }
  onOpen: (item: Appointment) => void
}) {
  const short = placement !== undefined && placement.length < 0.75
  const details = showProfessional ? `${item.service} · ${item.professionalName}` : item.service
  return (
    <button
      type="button"
      className={past ? 'fr-cal-event fr-cal-event--past' : 'fr-cal-event'}
      style={{
        '--fr-start': placement?.start,
        '--fr-length': placement?.length,
        '--fr-column': placement?.column,
        '--fr-columns': placement?.columns,
      } as CSSProperties}
      aria-label={`${item.time}, ${item.customerName}, ${details}. Remarcar.`}
      onClick={() => onOpen(item)}
    >
      {short ? (
        <span className="caption">
          {item.time} · {item.customerName} · {details}
        </span>
      ) : (
        <>
          <span className="label">{item.customerName}</span>
          <span className="caption">
            {item.time} às {appointmentEnd(item).time} · {details}
          </span>
        </>
      )}
    </button>
  )
}

interface MonthGridProps {
  date: string
  today: string
  appointments: Appointment[]
  onDay: (date: string) => void
}

export function MonthGrid({ date, today, appointments, onDay }: MonthGridProps) {
  const counts = countByDay(appointments)
  return (
    <div>
      <WeekdayNames />
      <div className="fr-cal-month">
        {monthWeeks(date).map((week, index) => (
          <div key={index} className="fr-cal-week">
            {week.map((day, position) =>
              day ? (
                <DayCell
                  key={day}
                  date={day}
                  selected={day === date}
                  today={today}
                  count={counts.get(day) ?? 0}
                  onClick={() => onDay(day)}
                />
              ) : (
                <span key={position} />
              ),
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

interface MonthProps {
  date: string
  today: string
  appointments: Appointment[]
  showProfessional: boolean
  onSelect: (date: string) => void
  onOpenDay: () => void
  onOpen: (item: Appointment) => void
}

export function MonthView({ date, today, appointments, showProfessional, onSelect, onOpenDay, onOpen }: MonthProps) {
  const items = appointments.filter((item) => item.date === date)

  return (
    <>
      <MonthGrid
        date={date}
        today={today}
        appointments={appointments}
        onDay={(day) => (day === date ? onOpenDay() : onSelect(day))}
      />

      <div className="ef-stack">
        <div className="fr-cal-bar">
          <h2 className="title-md">{dayLabel(date, today)}</h2>
          <button type="button" className="ef-button ef-button--ghost ef-button--sm" onClick={onOpenDay}>
            Abrir dia
          </button>
        </div>
        {items.length === 0 ? (
          <p className="ef-card__text">Nenhum horário neste dia.</p>
        ) : (
          items.map((item) => (
            <EventButton
              key={item.id}
              item={item}
              past={date < today}
              showProfessional={showProfessional}
              onOpen={onOpen}
            />
          ))
        )}
      </div>
    </>
  )
}

function currentHour(): number {
  const now = new Date()
  return now.getHours() + now.getMinutes() / 60
}

interface DayProps {
  date: string
  today: string
  appointments: Appointment[]
  showProfessional: boolean
  onSelect: (date: string) => void
  onOpen: (item: Appointment) => void
  onNewAt: (time: string) => void
}

export function DayView({ date, today, appointments, showProfessional, onSelect, onOpen, onNewAt }: DayProps) {
  const [hourNow, setHourNow] = useState(currentHour)

  useEffect(() => {
    const timer = setInterval(() => setHourNow(currentHour()), 60_000)
    return () => clearInterval(timer)
  }, [])

  const counts = countByDay(appointments)
  const items = appointments.filter((item) => item.date === date)
  const { first, last } = dayHours(items)
  const hours = Array.from({ length: last - first }, (_, index) => first + index)
  const showNow = date === today && hourNow >= first && hourNow <= last

  return (
    <>
      <div>
        <WeekdayNames />
        <div className="fr-cal-week">
          {weekDays(date).map((day) => (
            <DayCell
              key={day}
              date={day}
              selected={day === date}
              today={today}
              count={counts.get(day) ?? 0}
              onClick={() => onSelect(day)}
            />
          ))}
        </div>
      </div>

      <div className="ef-stack">
        <h2 className="title-md">{dayLabel(date, today)}</h2>
        <div className="fr-cal-timeline">
          {hours.map((hour) => {
            const label = `${String(hour).padStart(2, '0')}:00`
            return (
              <button
                key={hour}
                type="button"
                className="fr-cal-hour"
                aria-label={`Marcar horário às ${label}`}
                onClick={() => onNewAt(label)}
              >
                <span className="caption">{label}</span>
              </button>
            )
          })}
          <div className="fr-cal-track">
            {layoutDay(items, first, last).map(({ item, start, length, column, columns }) => (
              <EventButton
                key={item.id}
                item={item}
                past={date < today}
                showProfessional={showProfessional}
                onOpen={onOpen}
                placement={{ start, length, column, columns }}
              />
            ))}
            {showNow && <span className="fr-cal-now" style={{ '--fr-now': hourNow - first } as CSSProperties} />}
          </div>
        </div>
      </div>
    </>
  )
}
