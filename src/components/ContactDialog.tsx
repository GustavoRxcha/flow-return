import { useState, type FormEvent } from 'react'
import { activeChannel } from '../lib/channel'
import { parseMoney } from '../lib/format'
import type { RosterRow } from '../lib/roster'
import { Dialog } from './Dialog'
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
        <p className="ef-modal__text">Pediu para não receber mensagens.</p>
        <div className="ef-modal__actions">
          <button type="button" className="ef-button ef-button--secondary" onClick={onClose}>
            Fechar
          </button>
          <button type="button" className="ef-button ef-button--primary" onClick={() => act({ type: 'backToQueue' })}>
            Voltar a chamar
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
            <span className="ef-field__label">Quanto gastou? (opcional)</span>
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
              Voltar
            </button>
            <button type="submit" className="ef-button ef-button--brand">
              Salvar
            </button>
          </div>
        </form>
      </Dialog>
    )
  }

  if (step === 'parar') {
    return (
      <Dialog title="Não chamar mais?" onClose={onClose}>
        <p className="ef-modal__text">{customer.name} não recebe mais mensagens.</p>
        <div className="ef-modal__actions">
          <button type="button" className="ef-button ef-button--secondary" onClick={() => setStep('menu')}>
            Voltar
          </button>
          <button type="button" className="ef-button ef-button--danger" onClick={() => act({ type: 'block' })}>
            Não chamar mais
          </button>
        </div>
      </Dialog>
    )
  }

  return (
    <Dialog title={customer.name} onClose={onClose}>
      <div className="ef-stack">
        <button type="button" className="ef-button ef-button--secondary ef-button--full" onClick={openWhatsApp}>
          Abrir WhatsApp
        </button>
        <button type="button" className="ef-button ef-button--primary ef-button--full" onClick={onReminder}>
          Enviar lembrete
        </button>
        {customer.status !== 'voltou' && (
          <button type="button" className="ef-button ef-button--secondary ef-button--full" onClick={() => setStep('voltou')}>
            Registrar que voltou
          </button>
        )}
        <button type="button" className="ef-button ef-button--danger ef-button--full" onClick={() => setStep('parar')}>
          Não chamar mais
        </button>
        <button type="button" className="ef-button ef-button--ghost ef-button--full" onClick={onClose}>
          Fechar
        </button>
      </div>
    </Dialog>
  )
}
