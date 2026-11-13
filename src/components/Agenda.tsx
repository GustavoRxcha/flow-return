import { useEffect, useState, type FormEvent } from 'react'
import { appointmentEnd, calendarLinks, findConflict, freeProfessionals, shiftMonth } from '../lib/agenda'
import { api, ApiError } from '../lib/api'
import { addDays } from '../lib/dates'
import { centsInput, parseCents } from '../lib/format'
import { APPOINTMENT_DURATIONS } from '../lib/types'
import type { Appointment, AppointmentInput, Professional, Service } from '../lib/types'
import { CalendarToolbar, DayView, MonthView } from './CalendarViews'
import { ConfirmDialog } from './ConfirmDialog'

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

  if (!data) return <p className="fr-status">Carregando...</p>

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
        setFormError('Esse período acabou de ser ocupado. Escolha outra hora.')
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
          <span className="ef-field__label">Profissional</span>
          <select
            className="ef-input"
            value={professionalFilter}
            onChange={(event) => setProfessionalFilter(event.target.value)}
          >
            <option value="">Todos</option>
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
function busyMessage(conflict: Appointment, listed: number, free: number): string {
  if (listed > 1 && free === 0) return 'Todos os profissionais estão ocupados nesse período. Escolha outra hora.'
  const period = `das ${conflict.time} às ${appointmentEnd(conflict).time}`
  if (listed === 1) return `Esse período está ocupado por ${conflict.customerName}, ${period}. Escolha outra hora.`
  return `${conflict.professionalName} atende ${conflict.customerName} ${period}. Escolha outra hora ou outro profissional.`
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

  // Quem saiu da lista continua nos horários que já tinha.
  const options =
    appointment && !professionals.some((item) => item.id === appointment.professionalId)
      ? [...professionals, { id: appointment.professionalId, name: appointment.professionalName }]
      : professionals
  const free = freeProfessionals(options, appointments, form, appointment?.id)
  const conflict = findConflict(appointments, form, appointment?.id)
  const message = conflict ? busyMessage(conflict, options.length, free.length) : error

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
      <h2 className="title-md">{appointment ? 'Remarcar horário' : 'Novo horário'}</h2>
      <label className="ef-field">
        <span className="ef-field__label">Cliente</span>
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
        <span className="ef-field__label">Serviço</span>
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
      <div className="ef-stats">
        <label className="ef-field">
          <span className="ef-field__label">Data</span>
          <input className="ef-input" type="date" required value={form.date} onChange={set('date')} />
        </label>
        <label className="ef-field">
          <span className="ef-field__label">Hora</span>
          <input className="ef-input" type="time" required value={form.time} onChange={set('time')} />
        </label>
      </div>
      <div className="ef-stats">
        <label className="ef-field">
          <span className="ef-field__label">Duração</span>
          <select
            className="ef-input"
            value={form.durationMinutes}
            onChange={(event) => setForm({ ...form, durationMinutes: Number(event.target.value) })}
          >
            {APPOINTMENT_DURATIONS.map((minutes) => (
              <option key={minutes} value={minutes}>
                {minutes} minutos
              </option>
            ))}
          </select>
        </label>
        <label className="ef-field">
          <span className="ef-field__label">Valor (R$)</span>
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
          {priceInvalid && <span className="ef-field__error">Escreva o valor assim: 45,00.</span>}
        </label>
      </div>
      {options.length > 1 && (
        <label className="ef-field">
          <span className="ef-field__label">Profissional</span>
          <select className="ef-input" value={form.professionalId} onChange={set('professionalId')}>
            {options.map((item) => {
              const busy = !free.some((person) => person.id === item.id)
              return (
                <option key={item.id} value={item.id} disabled={busy}>
                  {busy ? `${item.name} (ocupado)` : item.name}
                </option>
              )
            })}
          </select>
        </label>
      )}
      {message && (
        <p className="ef-alert ef-alert--danger" role="alert">
          <span className="ef-alert__title">Horário ocupado.</span> {message}
        </p>
      )}
      <div className="ef-row">
        <button type="submit" className="ef-button ef-button--brand" disabled={conflict !== null}>
          Salvar
        </button>
        <button type="button" className="ef-button ef-button--secondary" onClick={onClose}>
          Voltar
        </button>
        {appointment && (
          <button type="button" className="ef-button ef-button--danger" onClick={() => setRemoving(true)}>
            Cancelar horário
          </button>
        )}
      </div>

      {appointment && removing && (
        <ConfirmDialog
          title="Cancelar este horário?"
          text={`O horário de ${appointment.customerName} sai da agenda.`}
          confirmLabel="Cancelar horário"
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
      <h2 className="title-md">Veja os horários na sua agenda.</h2>
      <p className="ef-card__text">Os horários marcados aqui aparecem no seu iPhone ou no Google Agenda.</p>
      <div className="ef-row">
        <button type="button" className="ef-button ef-button--secondary" onClick={() => open('ios')}>
          Vincular iOS
        </button>
        <button type="button" className="ef-button ef-button--secondary" onClick={() => open('google')}>
          Vincular Google
        </button>
      </div>
      <p className="ef-field__hint">Horários novos podem levar até um dia para aparecer no Google Agenda.</p>
      {unpublished && (
        <p className="ef-alert" role="status">
          O link já está pronto, mas só abre quando o sistema estiver publicado.
        </p>
      )}
      {token && (
        <div className="ef-row">
          <button type="button" className="ef-button ef-button--danger ef-button--sm" onClick={() => setUnlinking(true)}>
            Desvincular
          </button>
        </div>
      )}
      {unlinking && (
        <ConfirmDialog
          title="Desvincular a agenda?"
          text="O iPhone e o Google Agenda param de receber novos horários."
          confirmLabel="Desvincular"
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
