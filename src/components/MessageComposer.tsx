import { useState } from 'react'
import { activeChannel } from '../lib/channel'
import { MESSAGE_PRESETS } from '../lib/presets'
import { messageFor } from '../lib/roster'
import type { RosterRow } from '../lib/roster'
import type { Settings } from '../lib/types'
import { Dialog } from './Dialog'
import type { Dispatch } from './ReturnClientApp'

interface Props {
  recipients: RosterRow[]
  settings: Settings
  today: string
  demo: boolean
  leftToday: number
  dispatch: Dispatch
  onClose: (finished: boolean) => void
}

export function MessageComposer({ recipients, settings, today, demo, leftToday, dispatch, onClose }: Props) {
  const presets = MESSAGE_PRESETS.filter((preset) => !preset.needsNextVisit || recipients.every((row) => row.next))
  const single = recipients.length === 1
  const fill = (template: string, row: RosterRow) => messageFor(row, settings, template, today)
  /** Com uma pessoa, o texto já aparece pronto. Com várias, cada uma recebe os próprios dados no envio. */
  const start = (template: string) => (single ? fill(template, recipients[0]) : template)
  const [text, setText] = useState(() => start(presets[0].text))
  const [position, setPosition] = useState<number | null>(null)
  const [sent, setSent] = useState(0)
  const queue = recipients.slice(0, leftToday)
  const title = single ? 'Enviar lembrete' : `Mensagem para ${recipients.length} clientes`

  if (position === null) {
    return (
      <Dialog title={title} onClose={() => onClose(false)}>
        <div className="ef-stack">
          <div className="ef-row">
            {presets.map((preset) => (
              <button
                key={preset.label}
                type="button"
                className="ef-button ef-button--secondary ef-button--sm"
                onClick={() => setText(start(preset.text))}
              >
                {preset.label}
              </button>
            ))}
          </div>
          <label className="ef-field">
            <span className="ef-field__label">Mensagem</span>
            <textarea className="ef-input" rows={6} value={text} onChange={(event) => setText(event.target.value)} />
            {!single && (
              <span className="ef-field__hint">
                Use {'{nome}'}, {'{negocio}'}, {'{tempo}'}, {'{servico}'} e {'{proximo}'}. Cada pessoa recebe os próprios dados.
              </span>
            )}
          </label>
          {!single && text.trim() && (
            <p className="ef-alert">
              <span className="ef-alert__title">Exemplo para {recipients[0].customer.name}:</span>{' '}
              {fill(text, recipients[0])}
            </p>
          )}
          {queue.length < recipients.length && (
            <p className="ef-alert" role="status">
              Hoje dá para enviar mais {leftToday}. Ir aos poucos protege o seu número.
            </p>
          )}
        </div>
        <div className="ef-modal__actions">
          <button type="button" className="ef-button ef-button--secondary" onClick={() => onClose(false)}>
            Cancelar
          </button>
          <button
            type="button"
            className="ef-button ef-button--primary"
            disabled={!text.trim() || queue.length === 0}
            onClick={() => setPosition(0)}
          >
            Continuar
          </button>
        </div>
      </Dialog>
    )
  }

  const row = queue[position]

  if (!row) {
    return (
      <Dialog title="Fila concluída." onClose={() => onClose(true)}>
        <p className="ef-alert ef-alert--success" role="status">
          <span className="ef-alert__title">Pronto.</span>{' '}
          {sent === 1 ? '1 mensagem aberta no WhatsApp.' : `${sent} mensagens abertas no WhatsApp.`}
        </p>
        <div className="ef-modal__actions">
          <button type="button" className="ef-button ef-button--brand" onClick={() => onClose(true)}>
            Fechar
          </button>
        </div>
      </Dialog>
    )
  }

  const message = fill(text, row)

  async function send() {
    if (!demo) {
      const result = await activeChannel.send({ phone: row.customer.phone, text: message })
      if (result.kind === 'open-url') window.open(result.url, '_blank', 'noopener')
    }
    dispatch({ type: 'markSent', phone: row.customer.phone })
    setSent(sent + 1)
    setPosition(position! + 1)
  }

  return (
    <Dialog title={row.customer.name} onClose={() => onClose(sent > 0)}>
      <div className="ef-stack">
        <p className="ef-stat__label">
          {position + 1} de {queue.length}
        </p>
        <p className="ef-alert">{message}</p>
      </div>
      <div className="ef-modal__actions">
        <button type="button" className="ef-button ef-button--ghost" onClick={() => setPosition(position + 1)}>
          Pular
        </button>
        <button type="button" className="ef-button ef-button--primary" onClick={send}>
          Abrir no WhatsApp
        </button>
      </div>
    </Dialog>
  )
}
