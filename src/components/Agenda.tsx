import { useEffect, useState, type FormEvent } from 'react'
import { appointmentEnd, calendarLinks, findConflict, freeProfessionals, shiftMonth } from '../lib/agenda'
import { api, ApiError } from '../lib/api'
import { addDays } from '../lib/dates'
import { centsInput, parseCents } from '../lib/format'
import type { Appointment, AppointmentInput, Professional, Service } from '../lib/types'
import { CalendarToolbar, DayView, MonthView } from './CalendarViews'
import type { MessageKey, Params } from '../lib/i18n'
import { ConfirmDialog } from './ConfirmDialog'
import { usePreferences } from './Preferences'
import { DurationOptions } from './Services'

interface AgendaData {
  appointments: Appointment[]
  professionals: Professional[]
  services: Service[]
  calendarToken: string | null
  today: string
}

export type View = 'mes' | 'dia'

/** Por onde a agenda abre quando vem de outra tela. */
export interface AgendaTarget {
  date?: string
  view: View
}

interface Props {
  customerNames: string[]
  target: AgendaTarget | null
  onFailure: (failure: unknown) => void
}

type Editing = Appointment | { date: string; time: string } | null

export function Agenda({ customerNames, target, onFailure }: Props) {
  const [data, setData] = useState<AgendaData | null>(null)
  const [view, setView] = useState<View>(target?.view ?? 'mes')
  const [selected, setSelected] = useState<string | null>(target?.date ?? null)
  const [editing, setEditing] = useState<Editing>(null)
  const [formError, setFormError] = useState('')
  const [professionalFilter, setProfessionalFilter] = useState('')
  const { t } = usePreferences()

  useEffect(() => {
    api<AgendaData>('/workspace/agenda').then(setData).catch(onFailure)
  }, [onFailure])

  async function send(path: string, method: string, body?: AppointmentInput): Promise<boolean> {
    try {
      setData(await api<AgendaData>(path, { method, body }))
      return true
    } catch (failure) {
      onFailure(failure)
      return false
    }
  }

  if (!data) return <p className="fr-status">{t('common.loading')}</p>

  const { appointments, professionals, services, today, calendarToken } = data
  const date = selected ?? today
  const several = professionals.length > 1
  const visible = professionalFilter
    ? appointments.filter((item) => item.professionalId === professionalFilter)
    : appointments

  async function save(input: AppointmentInput) {
    const editingId = editing && 'id' in editing ? editing.id : undefined
    try {
      const next = editingId
        ? await api<AgendaData>(`/workspace/agenda/${editingId}`, { method: 'PUT', body: input })
        : await api<AgendaData>('/workspace/agenda', { body: input })
      setData(next)
      setSelected(input.date)
      closeForm()
    } catch (failure) {
      if (failure instanceof ApiError && failure.code === 'horario_ocupado') {
        setFormError(t('agenda.justTaken'))
      } else {
        onFailure(failure)
      }
    }
  }

  function closeForm() {
    setFormError('')
    setEditing(null)
  }

  async function remove(id: string) {
    if (await send(`/workspace/agenda/${id}`, 'DELETE')) closeForm()
  }

  if (editing) {
    return (
      <AppointmentForm
        appointment={'id' in editing ? editing : null}
        initial={editing}
        professionals={professionals}
        appointments={appointments}
        preferredProfessional={professionalFilter}
        services={services}
        customerNames={customerNames}
        onSave={save}
        error={formError}
        onRemove={remove}
        onClose={closeForm}
      />
    )
  }

  const shift = (amount: number) =>
    setSelected(view === 'mes' ? shiftMonth(date, amount, today) : addDays(date, amount))
  const openNew = (time = '09:00') => setEditing({ date, time })

  return (
    <section className="fr-stack-lg">
      <CalendarToolbar
        date={date}
        view={view}
        onPrevious={() => shift(-1)}
        onNext={() => shift(1)}
        onToday={() => setSelected(today)}
        onView={setView}
        onNew={() => openNew()}
      />

      {several && (
        <label className="ef-field">
          <span className="ef-field__label">{t('agenda.professional')}</span>
          <select
            className="ef-input"
            value={professionalFilter}
            onChange={(event) => setProfessionalFilter(event.target.value)}
          >
            <option value="">{t('common.all')}</option>
            {professionals.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
      )}

      {view === 'mes' ? (
        <>
          <MonthView
            date={date}
            today={today}
            appointments={visible}
            showProfessional={several}
            onSelect={setSelected}
            onOpenDay={() => setView('dia')}
            onOpen={setEditing}
          />
          <CalendarLink
            token={calendarToken}
            onLink={async () => {
              try {
                const next = await api<AgendaData>('/workspace/agenda/link', { method: 'POST' })
                setData(next)
                return next.calendarToken
              } catch (failure) {
                onFailure(failure)
                return null
              }
            }}
            onUnlink={() => send('/workspace/agenda/link', 'DELETE')}
          />
        </>
      ) : (
        <DayView
          date={date}
          today={today}
          appointments={visible}
          showProfessional={several}
          onSelect={setSelected}
          onOpen={setEditing}
          onNewAt={openNew}
        />
      )}
    </section>
  )
}

interface FormProps {
  appointment: Appointment | null
  initial: { date: string; time: string }
  professionals: Professional[]
  appointments: Appointment[]
  preferredProfessional: string
  services: Service[]
  customerNames: string[]
  error: string
  onSave: (input: AppointmentInput) => Promise<void>
  onRemove: (id: string) => Promise<void>
  onClose: () => void
}

/** Explica por que o período não pode ser usado. */
function busyMessage(conflict: Appointment, listed: number, free: number): { key: MessageKey; params?: Params } {
  if (listed > 1 && free === 0) return { key: 'agenda.allBusy' }
  const params = { name: conflict.customerName, from: conflict.time, to: appointmentEnd(conflict).time, professional: conflict.professionalName }
  return { key: listed === 1 ? 'agenda.busyBy' : 'agenda.busyWith', params }
}

function AppointmentForm({
  appointment,
  initial,
  professionals,
  appointments,
  preferredProfessional,
  services,
  customerNames,
  error,
  onSave,
  onRemove,
  onClose,
}: FormProps) {
  const [form, setForm] = useState<AppointmentInput>(() => {
    if (appointment) return appointment
    const slot = {
      customerName: '',
      service: '',
      date: initial.date,
      time: initial.time,
      durationMinutes: 30,
      priceCents: null,
    }
    const [firstFree] = freeProfessionals(professionals, appointments, slot)
    return { ...slot, professionalId: preferredProfessional || firstFree?.id || professionals[0].id }
  })
  const [removing, setRemoving] = useState(false)
  const [price, setPrice] = useState(centsInput(appointment?.priceCents ?? null))
  const [priceInvalid, setPriceInvalid] = useState(false)
  const { t } = usePreferences()

  // Quem saiu da lista continua nos horários que já tinha.
  const options =
    appointment && !professionals.some((item) => item.id === appointment.professionalId)
      ? [...professionals, { id: appointment.professionalId, name: appointment.professionalName }]
      : professionals
  const free = freeProfessionals(options, appointments, form, appointment?.id)
  const conflict = findConflict(appointments, form, appointment?.id)
  const busy = conflict ? busyMessage(conflict, options.length, free.length) : null
  const message = busy ? t(busy.key, busy.params) : error

  const set =
    (key: 'professionalId' | 'customerName' | 'date' | 'time') => (event: { target: { value: string } }) =>
      setForm({ ...form, [key]: event.target.value })

  function chooseService(name: string) {
    const key = name.trim().toLocaleLowerCase('pt-BR')
    const listed = services.find((item) => item.name.toLocaleLowerCase('pt-BR') === key)
    setForm({ ...form, service: name, durationMinutes: listed?.durationMinutes ?? form.durationMinutes })
    if (listed?.priceCents !== undefined && listed.priceCents !== null) {
      setPrice(centsInput(listed.priceCents))
      setPriceInvalid(false)
    }
  }

  function submit(event: FormEvent) {
    event.preventDefault()
    const priceCents = parseCents(price)
    if (price.trim() && priceCents === undefined) {
      setPriceInvalid(true)
      return
    }
    if (!conflict) void onSave({ ...form, priceCents: priceCents ?? null })
  }

  return (
    <form className="ef-card" onSubmit={submit}>
      <h2 className="title-md">{appointment ? t('agenda.reschedule') : t('agenda.new')}</h2>
      <label className="ef-field">
        <span className="ef-field__label">{t('agenda.customer')}</span>
        <input
          className="ef-input"
          required
          maxLength={120}
          list="agenda-clientes-finais"
          value={form.customerName}
          onChange={set('customerName')}
        />
        <datalist id="agenda-clientes-finais">
          {customerNames.map((name) => (
            <option key={name} value={name} />
          ))}
        </datalist>
      </label>
      <label className="ef-field">
        <span className="ef-field__label">{t('agenda.service')}</span>
        <input
          className="ef-input"
          required
          maxLength={120}
          list="agenda-servicos"
          value={form.service}
          onChange={(event) => chooseService(event.target.value)}
        />
        <datalist id="agenda-servicos">
          {services.map((item) => (
            <option key={item.id} value={item.name} />
          ))}
        </datalist>
      </label>
      <div className="fr-pair">
        <label className="ef-field">
          <span className="ef-field__label">{t('agenda.date')}</span>
          <input className="ef-input" type="date" required value={form.date} onChange={set('date')} />
        </label>
        <label className="ef-field">
          <span className="ef-field__label">{t('agenda.time')}</span>
          <input className="ef-input" type="time" required value={form.time} onChange={set('time')} />
        </label>
      </div>
      <div className="fr-pair">
        <label className="ef-field">
          <span className="ef-field__label">{t('services.duration')}</span>
          <select
            className="ef-input"
            value={form.durationMinutes}
            onChange={(event) => setForm({ ...form, durationMinutes: Number(event.target.value) })}
          >
            <DurationOptions />
          </select>
        </label>
        <label className="ef-field">
          <span className="ef-field__label">{t('services.price')}</span>
          <input
            className="ef-input"
            inputMode="decimal"
            placeholder="0,00"
            aria-invalid={priceInvalid}
            value={price}
            onChange={(event) => {
              setPrice(event.target.value)
              setPriceInvalid(false)
            }}
          />
          {priceInvalid && <span className="ef-field__error">{t('common.priceFormat')}</span>}
        </label>
      </div>
      {options.length > 1 && (
        <label className="ef-field">
          <span className="ef-field__label">{t('agenda.professional')}</span>
          <select className="ef-input" value={form.professionalId} onChange={set('professionalId')}>
            {options.map((item) => {
              const taken = !free.some((person) => person.id === item.id)
              return (
                <option key={item.id} value={item.id} disabled={taken}>
                  {taken ? t('agenda.busyOption', { name: item.name }) : item.name}
                </option>
              )
            })}
          </select>
        </label>
      )}
      {message && (
        <p className="ef-alert ef-alert--danger" role="alert">
          <span className="ef-alert__title">{t('agenda.busyTitle')}</span> {message}
        </p>
      )}
      <div className="ef-row">
        <button type="submit" className="ef-button ef-button--brand" disabled={conflict !== null}>
          {t('common.save')}
        </button>
        <button type="button" className="ef-button ef-button--secondary" onClick={onClose}>
          {t('common.back')}
        </button>
        {appointment && (
          <button type="button" className="ef-button ef-button--danger" onClick={() => setRemoving(true)}>
            {t('agenda.cancel')}
          </button>
        )}
      </div>

      {appointment && removing && (
        <ConfirmDialog
          title={t('agenda.cancelTitle')}
          text={t('agenda.cancelText', { name: appointment.customerName })}
          confirmLabel={t('agenda.cancel')}
          onConfirm={() => void onRemove(appointment.id)}
          onClose={() => setRemoving(false)}
        />
      )}
    </form>
  )
}

interface LinkProps {
  token: string | null
  onLink: () => Promise<string | null>
  onUnlink: () => Promise<boolean>
}

function CalendarLink({ token, onLink, onUnlink }: LinkProps) {
  const [unpublished, setUnpublished] = useState(false)
  const [unlinking, setUnlinking] = useState(false)
  const { t } = usePreferences()

  async function open(target: 'ios' | 'google') {
    const code = await onLink()
    if (!code) return
    if (['localhost', '127.0.0.1'].includes(window.location.hostname)) {
      setUnpublished(true)
      return
    }
    const links = calendarLinks(window.location.host, code)
    if (target === 'ios') window.location.href = links.ios
    else window.open(links.google, '_blank', 'noopener')
  }

  return (
    <div className="ef-card ef-card--panel">
      <h2 className="title-md">{t('agenda.linkTitle')}</h2>
      <p className="ef-card__text">{t('agenda.linkText')}</p>
      <div className="ef-row">
        <button type="button" className="ef-button ef-button--secondary" onClick={() => open('ios')}>
          {t('agenda.linkIos')}
        </button>
        <button type="button" className="ef-button ef-button--secondary" onClick={() => open('google')}>
          {t('agenda.linkGoogle')}
        </button>
      </div>
      <p className="ef-field__hint">{t('agenda.linkHint')}</p>
      {unpublished && (
        <p className="ef-alert" role="status">
          {t('agenda.unpublished')}
        </p>
      )}
      {token && (
        <div className="ef-row">
          <button type="button" className="ef-button ef-button--danger ef-button--sm" onClick={() => setUnlinking(true)}>
            {t('agenda.unlink')}
          </button>
        </div>
      )}
      {unlinking && (
        <ConfirmDialog
          title={t('agenda.unlinkTitle')}
          text={t('agenda.unlinkText')}
          confirmLabel={t('agenda.unlink')}
          onConfirm={() => {
            setUnlinking(false)
            setUnpublished(false)
            void onUnlink()
          }}
          onClose={() => setUnlinking(false)}
        />
      )}
    </div>
  )
}
