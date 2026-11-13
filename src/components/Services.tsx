import { useEffect, useState, type FormEvent } from 'react'
import { api, ApiError } from '../lib/api'
import { centsInput, parseCents } from '../lib/format'
import { APPOINTMENT_DURATIONS } from '../lib/types'
import type { Service, ServiceInput } from '../lib/types'
import { ConfirmDialog } from './ConfirmDialog'

const DEFAULT_DURATION = 30
const INVALID_PRICE = 'Escreva o valor assim: 45,00.'

function DurationOptions() {
  return APPOINTMENT_DURATIONS.map((minutes) => (
    <option key={minutes} value={minutes}>
      {minutes} minutos
    </option>
  ))
}

export function Services({ onFailure }: { onFailure: (failure: unknown) => void }) {
  const [services, setServices] = useState<Service[] | null>(null)
  const [name, setName] = useState('')
  const [durationMinutes, setDurationMinutes] = useState(DEFAULT_DURATION)
  const [price, setPrice] = useState('')
  const [error, setError] = useState('')
  const [removing, setRemoving] = useState<Service | null>(null)
  const [version, setVersion] = useState(0)

  useEffect(() => {
    api<{ services: Service[] }>('/workspace/services')
      .then((data) => setServices(data.services))
      .catch(onFailure)
  }, [onFailure])

  async function send(path: string, method: string, body?: ServiceInput): Promise<boolean> {
    setError('')
    try {
      const data = await api<{ services: Service[] }>(path, { method, body })
      setServices(data.services)
      return true
    } catch (failure) {
      if (failure instanceof ApiError && failure.code === 'nome_em_uso') {
        setError('Já existe um serviço com esse nome. Use outro nome.')
      } else {
        onFailure(failure)
      }
      return false
    }
  }

  async function add(event: FormEvent) {
    event.preventDefault()
    const priceCents = parseCents(price)
    if (priceCents === undefined) {
      setError(INVALID_PRICE)
      return
    }
    if (await send('/workspace/services', 'POST', { name, durationMinutes, priceCents })) {
      setName('')
      setPrice('')
    }
  }

  async function change(item: Service, input: ServiceInput) {
    const unchanged =
      input.name.trim() === item.name &&
      input.durationMinutes === item.durationMinutes &&
      input.priceCents === item.priceCents
    if (!input.name.trim() || unchanged || !(await send(`/workspace/services/${item.id}`, 'PUT', input))) {
      setVersion(version + 1)
    }
  }

  function changePrice(item: Service, text: string) {
    const priceCents = parseCents(text)
    if (priceCents === undefined && text.trim()) {
      setError(INVALID_PRICE)
      setVersion(version + 1)
      return
    }
    void change(item, { ...item, priceCents: priceCents ?? null })
  }

  if (!services) return <p className="fr-status">Carregando...</p>

  return (
    <section className="fr-stack-lg">
      <div className="ef-stack">
        <h1 className="title-lg">Serviços</h1>
        <p className="ef-card__text">Adicione o que você oferece. Ao marcar um horário, a duração e o valor já vêm preenchidos.</p>
      </div>

      <form className="ef-card ef-card--panel" onSubmit={add}>
        <div className="fr-service-form">
          <label className="ef-field">
            <span className="ef-field__label">Novo serviço</span>
            <input
              className="ef-input"
              required
              maxLength={120}
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </label>
          <label className="ef-field">
            <span className="ef-field__label">Duração</span>
            <select
              className="ef-input"
              value={durationMinutes}
              onChange={(event) => setDurationMinutes(Number(event.target.value))}
            >
              <DurationOptions />
            </select>
          </label>
          <label className="ef-field">
            <span className="ef-field__label">Valor (R$)</span>
            <input
              className="ef-input"
              required
              inputMode="decimal"
              placeholder="0,00"
              value={price}
              onChange={(event) => setPrice(event.target.value)}
            />
          </label>
          <button type="submit" className="ef-button ef-button--primary">
            Adicionar
          </button>
        </div>
        {error && (
          <p className="ef-alert ef-alert--danger" role="alert">
            {error}
          </p>
        )}
      </form>

      {services.length === 0 ? (
        <p className="ef-card__text">Nenhum serviço ainda.</p>
      ) : (
        <div className="ef-card">
          <ul className="ef-list">
            {services.map((item) => (
              <li key={item.id} className="ef-item fr-service">
                <input
                  key={`${item.name}-${version}`}
                  className="ef-input"
                  aria-label={`Nome de ${item.name}`}
                  maxLength={120}
                  defaultValue={item.name}
                  onBlur={(event) => void change(item, { ...item, name: event.target.value })}
                />
                <select
                  className="ef-input"
                  aria-label={`Duração de ${item.name}`}
                  value={item.durationMinutes}
                  onChange={(event) => void change(item, { ...item, durationMinutes: Number(event.target.value) })}
                >
                  <DurationOptions />
                </select>
                <input
                  key={`${item.priceCents}-${version}`}
                  className="ef-input"
                  aria-label={`Valor de ${item.name} em reais`}
                  inputMode="decimal"
                  placeholder="0,00"
                  defaultValue={centsInput(item.priceCents)}
                  onBlur={(event) => changePrice(item, event.target.value)}
                />
                <button
                  type="button"
                  className="ef-button ef-button--danger ef-button--sm"
                  onClick={() => setRemoving(item)}
                >
                  Remover
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {removing && (
        <ConfirmDialog
          title={`Remover ${removing.name}?`}
          text="Esse serviço sai da lista. Os horários já marcados continuam na agenda."
          confirmLabel="Remover"
          onConfirm={() => {
            setRemoving(null)
            void send(`/workspace/services/${removing.id}`, 'DELETE')
          }}
          onClose={() => setRemoving(null)}
        />
      )}
    </section>
  )
}
