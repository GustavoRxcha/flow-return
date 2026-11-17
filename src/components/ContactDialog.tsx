import { useState, type FormEvent } from 'react'
import { activeChannel } from '../lib/channel'
import { parseMoney } from '../lib/format'
import type { RosterRow } from '../lib/roster'
import { Dialog } from './Dialog'
import { usePreferences } from './Preferences'
import type { Dispatch } from './ReturnClientApp'

interface Props {
  row: RosterRow
  demo: boolean
  dispatch: Dispatch
  onReminder: () => void
  onClose: () => void
}

export function ContactDialog({ row, demo, dispatch, onReminder, onClose }: Props) {
  const { customer } = row
  const [step, setStep] = useState<'menu' | 'voltou' | 'parar'>('menu')
  const [value, setValue] = useState('')
  const { t } = usePreferences()

  function act(action: Record<string, unknown> & { type: string }) {
    dispatch({ ...action, phone: customer.phone })
    onClose()
  }

  async function openWhatsApp() {
    if (!demo) {
      const result = await activeChannel.send({ phone: customer.phone, text: '' })
      if (result.kind === 'open-url') window.open(result.url, '_blank', 'noopener')
    }
    onClose()
  }

  function submitReturned(event: FormEvent) {
    event.preventDefault()
    act({ type: 'markReturned', value: parseMoney(value) })
  }

  if (customer.status === 'nao_chamar') {
    return (
      <Dialog title={customer.name} onClose={onClose}>
        <p className="ef-modal__text">{t('contact.optedOut')}</p>
        <div className="ef-modal__actions">
          <button type="button" className="ef-button ef-button--secondary" onClick={onClose}>
            {t('common.close')}
          </button>
          <button type="button" className="ef-button ef-button--primary" onClick={() => act({ type: 'backToQueue' })}>
            {t('contact.callAgain')}
          </button>
        </div>
      </Dialog>
    )
  }

  if (step === 'voltou') {
    return (
      <Dialog title={customer.name} onClose={onClose}>
        <form className="ef-stack" onSubmit={submitReturned}>
          <label className="ef-field">
            <span className="ef-field__label">{t('contact.spent')}</span>
            <input
              className="ef-input"
              autoFocus
              inputMode="decimal"
              placeholder="R$ 80"
              value={value}
              onChange={(event) => setValue(event.target.value)}
            />
          </label>
          <div className="ef-modal__actions">
            <button type="button" className="ef-button ef-button--secondary" onClick={() => setStep('menu')}>
              {t('common.back')}
            </button>
            <button type="submit" className="ef-button ef-button--brand">
              {t('common.save')}
            </button>
          </div>
        </form>
      </Dialog>
    )
  }

  if (step === 'parar') {
    return (
      <Dialog title={t('contact.stopTitle')} onClose={onClose}>
        <p className="ef-modal__text">{t('contact.stopText', { name: customer.name })}</p>
        <div className="ef-modal__actions">
          <button type="button" className="ef-button ef-button--secondary" onClick={() => setStep('menu')}>
            {t('common.back')}
          </button>
          <button type="button" className="ef-button ef-button--danger" onClick={() => act({ type: 'block' })}>
            {t('contact.stop')}
          </button>
        </div>
      </Dialog>
    )
  }

  return (
    <Dialog title={customer.name} onClose={onClose}>
      <div className="ef-stack">
        <button type="button" className="ef-button ef-button--secondary ef-button--full" onClick={openWhatsApp}>
          {t('contact.openWhatsApp')}
        </button>
        <button type="button" className="ef-button ef-button--primary ef-button--full" onClick={onReminder}>
          {t('contact.reminder')}
        </button>
        {customer.status !== 'voltou' && (
          <button type="button" className="ef-button ef-button--secondary ef-button--full" onClick={() => setStep('voltou')}>
            {t('contact.returned')}
          </button>
        )}
        <button type="button" className="ef-button ef-button--danger ef-button--full" onClick={() => setStep('parar')}>
          {t('contact.stop')}
        </button>
        <button type="button" className="ef-button ef-button--ghost ef-button--full" onClick={onClose}>
          {t('common.close')}
        </button>
      </div>
    </Dialog>
  )
}
