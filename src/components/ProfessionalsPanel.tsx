import { useEffect, useState, type FormEvent } from 'react'
import { api, ApiError } from '../lib/api'
import type { Professional } from '../lib/types'
import type { MessageKey } from '../lib/i18n'
import { ConfirmDialog } from './ConfirmDialog'
import { usePreferences } from './Preferences'

const MESSAGES: Record<string, MessageKey> = {
  nome_em_uso: 'pros.nameInUse',
  tem_horarios: 'pros.hasAppointments',
  ultimo_profissional: 'pros.lastOne',
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
  const { t } = usePreferences()

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
      if (message) setError(t(message))
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
        <h2 className="title-md">{t('pros.title')}</h2>
        <p className="ef-card__text">{t('pros.text')}</p>
      </div>

      <ul className="ef-list">
        {professionals.map((item) => (
          <li key={item.id} className="ef-item fr-professional">
            <input
              key={`${item.name}-${version}`}
              className="ef-input"
              aria-label={t('pros.nameOf', { name: item.name })}
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
                {t('common.remove')}
              </button>
            )}
          </li>
        ))}
      </ul>

      <form className="fr-professional" onSubmit={add}>
        <label className="ef-field">
          <span className="ef-field__label">{t('pros.new')}</span>
          <input
            className="ef-input"
            required
            maxLength={120}
            value={newName}
            onChange={(event) => setNewName(event.target.value)}
          />
        </label>
        <button type="submit" className="ef-button ef-button--primary ef-button--sm">
          {t('common.add')}
        </button>
      </form>

      {error && (
        <p className="ef-alert ef-alert--danger" role="alert">
          {error}
        </p>
      )}

      {removing && (
        <ConfirmDialog
          title={t('pros.removeTitle', { name: removing.name })}
          text={t('pros.removeText')}
          confirmLabel={t('common.remove')}
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
