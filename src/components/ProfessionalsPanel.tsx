import { useEffect, useState, type FormEvent } from 'react'
import { api, ApiError } from '../lib/api'
import type { Professional } from '../lib/types'
import { ConfirmDialog } from './ConfirmDialog'

const MESSAGES: Record<string, string> = {
  nome_em_uso: 'Já existe um profissional com esse nome. Use outro nome.',
  tem_horarios: 'Esse profissional tem horários marcados. Remarque ou cancele esses horários e tente de novo.',
  ultimo_profissional: 'Seu negócio precisa de pelo menos um profissional.',
}

interface Reply {
  professionals: Professional[]
}

export function ProfessionalsPanel({ onFailure }: { onFailure: (failure: unknown) => void }) {
  const [professionals, setProfessionals] = useState<Professional[] | null>(null)
  const [newName, setNewName] = useState('')
  const [error, setError] = useState('')
  const [removing, setRemoving] = useState<Professional | null>(null)
  const [version, setVersion] = useState(0)

  useEffect(() => {
    api<Reply>('/workspace/professionals')
      .then((data) => setProfessionals(data.professionals))
      .catch(onFailure)
  }, [onFailure])

  async function send(path: string, method: string, body?: { name: string }): Promise<boolean> {
    setError('')
    try {
      const data = await api<Reply>(path, { method, body })
      setProfessionals(data.professionals)
      return true
    } catch (failure) {
      const message = failure instanceof ApiError ? MESSAGES[failure.code] : undefined
      if (message) setError(message)
      else onFailure(failure)
      return false
    }
  }

  async function add(event: FormEvent) {
    event.preventDefault()
    if (await send('/workspace/professionals', 'POST', { name: newName })) setNewName('')
  }

  async function rename(item: Professional, name: string) {
    if (!name.trim() || name.trim() === item.name) {
      setVersion(version + 1)
      return
    }
    if (!(await send(`/workspace/professionals/${item.id}`, 'PUT', { name }))) setVersion(version + 1)
  }

  if (!professionals) return null

  return (
    <div className="ef-card ef-card--panel">
      <div>
        <h2 className="title-md">Profissionais</h2>
        <p className="ef-card__text">Cada profissional tem a própria agenda. Com dois, você marca duas pessoas no mesmo horário.</p>
      </div>

      <ul className="ef-list">
        {professionals.map((item) => (
          <li key={item.id} className="ef-item fr-professional">
            <input
              key={`${item.name}-${version}`}
              className="ef-input"
              aria-label={`Nome de ${item.name}`}
              maxLength={120}
              defaultValue={item.name}
              onBlur={(event) => void rename(item, event.target.value)}
            />
            {professionals.length > 1 && (
              <button
                type="button"
                className="ef-button ef-button--danger ef-button--sm"
                onClick={() => setRemoving(item)}
              >
                Remover
              </button>
            )}
          </li>
        ))}
      </ul>

      <form className="fr-professional" onSubmit={add}>
        <label className="ef-field">
          <span className="ef-field__label">Novo profissional</span>
          <input
            className="ef-input"
            required
            maxLength={120}
            value={newName}
            onChange={(event) => setNewName(event.target.value)}
          />
        </label>
        <button type="submit" className="ef-button ef-button--primary ef-button--sm">
          Adicionar
        </button>
      </form>

      {error && (
        <p className="ef-alert ef-alert--danger" role="alert">
          {error}
        </p>
      )}

      {removing && (
        <ConfirmDialog
          title={`Remover ${removing.name}?`}
          text="Esse nome sai da lista. Os horários que já passaram continuam na agenda."
          confirmLabel="Remover"
          onConfirm={() => {
            setRemoving(null)
            void send(`/workspace/professionals/${removing.id}`, 'DELETE')
          }}
          onClose={() => setRemoving(null)}
        />
      )}
    </div>
  )
}
