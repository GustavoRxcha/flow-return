import { useState } from 'react'
import { activeChannel } from '../lib/channel'
import { MESSAGE_PRESETS } from '../lib/presets'
import { messageFor } from '../lib/roster'
import type { RosterRow } from '../lib/roster'
import type { Settings } from '../lib/types'
import { Dialog } from './Dialog'
import { usePreferences } from './Preferences'
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
  const { t, tp } = usePreferences()
  const presets = MESSAGE_PRESETS.filter((preset) => !preset.needsNextVisit || recipients.every((row) => row.next))
  const single = recipients.length === 1
  const fill = (template: string, row: RosterRow) => messageFor(row, settings, template, today)
  /** Com uma pessoa, o texto já aparece pronto. Com várias, cada uma recebe os próprios dados no envio. */
  const start = (template: string) => (single ? fill(template, recipients[0]) : template)
  const [text, setText] = useState(() => start(presets[0].text))
  const [position, setPosition] = useState<number | null>(null)
  const [sent, setSent] = useState(0)
  const queue = recipients.slice(0, leftToday)
  const title = single ? t('composer.single') : t('composer.many', { n: recipients.length })

  if (position === null) {
    return (
      <Dialog title={title} onClose={() => onClose(false)}>
        <div className="ef-stack">
          <div className="ef-row">
            {presets.map((preset) => (
              <button
                key={preset.key}
                type="button"
                className="ef-button ef-button--secondary ef-button--sm"
                onClick={() => setText(start(preset.text))}
              >
                {t(`preset.${preset.key}`)}
              </button>
            ))}
          </div>
          <label className="ef-field">
            <span className="ef-field__label">{t('composer.message')}</span>
            <textarea className="ef-input" rows={6} value={text} onChange={(event) => setText(event.target.value)} />
            {!single && (
              <span className="ef-field__hint">
                {t('composer.hint')}
              </span>
            )}
          </label>
          {!single && text.trim() && (
            <p className="ef-alert">
              <span className="ef-alert__title">{t('composer.example', { name: recipients[0].customer.name })}</span>{' '}
              {fill(text, recipients[0])}
            </p>
          )}
          {queue.length < recipients.length && (
            <p className="ef-alert" role="status">
              {t('composer.limit', { n: leftToday })}
            </p>
          )}
        </div>
        <div className="ef-modal__actions">
          <button type="button" className="ef-button ef-button--secondary" onClick={() => onClose(false)}>
            {t('common.cancel')}
          </button>
          <button
            type="button"
            className="ef-button ef-button--primary"
            disabled={!text.trim() || queue.length === 0}
            onClick={() => setPosition(0)}
          >
            {t('composer.continue')}
          </button>
        </div>
      </Dialog>
    )
  }

  const row = queue[position]

  if (!row) {
    return (
      <Dialog title={t('composer.finished')} onClose={() => onClose(true)}>
        <p className="ef-alert ef-alert--success" role="status">
          <span className="ef-alert__title">{t('common.done')}</span>{' '}
          {tp('composer.opened', sent)}
        </p>
        <div className="ef-modal__actions">
          <button type="button" className="ef-button ef-button--brand" onClick={() => onClose(true)}>
            {t('common.close')}
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
          {t('composer.position', { n: position + 1, total: queue.length })}
        </p>
        <p className="ef-alert">{message}</p>
      </div>
      <div className="ef-modal__actions">
        <button type="button" className="ef-button ef-button--ghost" onClick={() => setPosition(position + 1)}>
          {t('composer.skip')}
        </button>
        <button type="button" className="ef-button ef-button--primary" onClick={send}>
          {t('composer.open')}
        </button>
      </div>
    </Dialog>
  )
}
