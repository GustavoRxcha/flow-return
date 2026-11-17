import { useEffect, useRef, useState, type FormEvent } from 'react'
import { api, ApiError } from '../lib/api'
import { formatBrPhone, normalizeBrPhone } from '../lib/phone'
import { PAYMENT_METHODS, YES_NO_QUESTIONS, type BusinessInfo, type PaymentMethod, type YesNo } from '../lib/businessInfo'
import type { MessageKey } from '../lib/i18n'
import type { AssistantSettings, EndCustomer } from '../lib/types'
import { usePreferences } from './Preferences'

/** Da segunda ao domingo, como o negócio costuma pensar a semana. Os nomes vêm de `assistant.week`. */
const WEEK = [1, 2, 3, 4, 5, 6, 0]

const ANSWERS: Array<{ value: string; label: MessageKey; answer: YesNo }> = [
  { value: '', label: 'assistant.notInformed', answer: null },
  { value: 'sim', label: 'assistant.yes', answer: true },
  { value: 'nao', label: 'assistant.no', answer: false },
]

interface Reply {
  assistant: AssistantSettings
}

interface ChatLine {
  from: 'cliente' | 'atendente' | 'sistema'
  text: string
}

interface Props {
  inQueue: number
  inactiveDays: number
  dailyLimit: number
  customers: EndCustomer[]
  onFailure: (failure: unknown) => void
  onDataChanged: () => void
}

export function AssistantPanel({ inQueue, inactiveDays, dailyLimit, customers, onFailure, onDataChanged }: Props) {
  const [form, setForm] = useState<(AssistantSettings & { phoneText: string; ownerPhoneText: string }) | null>(null)
  const [phoneError, setPhoneError] = useState('')
  const [ownerPhoneError, setOwnerPhoneError] = useState('')
  const [formError, setFormError] = useState('')
  const [saved, setSaved] = useState(false)
  const { t, tp, tl } = usePreferences()

  function load(reply: Reply) {
    const { phone, ownerPhone } = reply.assistant
    setForm({ ...reply.assistant, phoneText: phone ? formatBrPhone(phone) : '', ownerPhoneText: ownerPhone ? formatBrPhone(ownerPhone) : '' })
  }

  useEffect(() => {
    api<Reply>('/workspace/assistant').then(load).catch(onFailure)
  }, [onFailure])

  if (!form) return <p className="fr-status">{t('common.loading')}</p>

  function change(partial: Partial<typeof form>) {
    setSaved(false)
    setForm((current) => current && { ...current, ...partial })
  }

  function changeInfo(partial: Partial<BusinessInfo>) {
    change({ info: { ...form!.info, ...partial } })
  }

  function togglePayment(id: PaymentMethod, on: boolean) {
    changeInfo({ payments: on ? [...form!.info.payments, id] : form!.info.payments.filter((item) => item !== id) })
  }

  function toggleDay(day: number, on: boolean) {
    change({ openDays: on ? [...form!.openDays, day] : form!.openDays.filter((item) => item !== day) })
  }

  async function save(event: FormEvent) {
    event.preventDefault()
    setPhoneError('')
    setOwnerPhoneError('')
    setFormError('')
    if (!form!.openDays.length) return setFormError(t('assistant.pickDay'))
    if (form!.opensAt >= form!.closesAt) return setFormError(t('assistant.hoursOrder'))
    const { phoneText, ownerPhoneText, ...settings } = form!
    try {
      load(await api<Reply>('/workspace/assistant', { method: 'PUT', body: { ...settings, phone: phoneText, ownerPhone: ownerPhoneText } }))
      setSaved(true)
    } catch (failure) {
      if (failure instanceof ApiError && failure.code === 'telefone_invalido') {
        setPhoneError(t('assistant.badPhone'))
      } else if (failure instanceof ApiError && failure.code === 'telefone_dono_invalido') {
        setOwnerPhoneError(t('assistant.badPhone'))
      } else {
        onFailure(failure)
      }
    }
  }

  return (
    <section className="fr-stack-lg">
      <div className="ef-stack">
        <h1 className="title-lg">{t('assistant.title')}</h1>
        <p className="ef-card__text">{t('assistant.intro')}</p>
      </div>

      <p className="ef-alert">{t('assistant.notConnected')}</p>

      <div className="fr-assistant">
        <form className="fr-stack-lg" onSubmit={save}>
          <div className="ef-card">
            <h2 className="title-md">{t('assistant.numberAndName')}</h2>
            <label className="ef-field">
              <span className="ef-field__label">{t('assistant.phone')}</span>
              <input
                className="ef-input"
                inputMode="tel"
                placeholder="(11) 91234-5678"
                value={form.phoneText}
                aria-invalid={phoneError ? true : undefined}
                onChange={(event) => change({ phoneText: event.target.value })}
              />
              {phoneError ? (
                <span className="ef-field__error">{phoneError}</span>
              ) : (
                <span className="ef-field__hint">{t('assistant.phoneHint')}</span>
              )}
            </label>
            <label className="ef-field">
              <span className="ef-field__label">{t('assistant.ownerPhone')}</span>
              <input
                className="ef-input"
                inputMode="tel"
                placeholder="(11) 98765-4321"
                value={form.ownerPhoneText}
                aria-invalid={ownerPhoneError ? true : undefined}
                onChange={(event) => change({ ownerPhoneText: event.target.value })}
              />
              {ownerPhoneError ? (
                <span className="ef-field__error">{ownerPhoneError}</span>
              ) : (
                <span className="ef-field__hint">{t('assistant.ownerPhoneHint')}</span>
              )}
            </label>
            <label className="ef-field">
              <span className="ef-field__label">{t('assistant.name')}</span>
              <input
                className="ef-input"
                maxLength={40}
                placeholder={t('assistant.namePlaceholder')}
                value={form.name}
                onChange={(event) => change({ name: event.target.value })}
              />
              <span className="ef-field__hint">{t('assistant.nameHint')}</span>
            </label>
          </div>

          <div className="ef-card">
            <h2 className="title-md">{t('assistant.teachTitle')}</h2>
            <p className="ef-card__text">{t('assistant.teachText')}</p>
            <label className="ef-field">
              <span className="ef-field__label">{t('assistant.address')}</span>
              <input
                className="ef-input"
                maxLength={160}
                placeholder={t('assistant.addressPlaceholder')}
                value={form.info.address}
                onChange={(event) => changeInfo({ address: event.target.value })}
              />
            </label>
            <label className="ef-field">
              <span className="ef-field__label">{t('assistant.reference')}</span>
              <input
                className="ef-input"
                maxLength={120}
                placeholder={t('assistant.referencePlaceholder')}
                value={form.info.reference}
                onChange={(event) => changeInfo({ reference: event.target.value })}
              />
            </label>
            {YES_NO_QUESTIONS.map(({ key }) => (
              <label key={key} className="ef-field">
                <span className="ef-field__label">{t(`assistant.question.${key}`)}</span>
                <select
                  className="ef-input"
                  value={ANSWERS.find(({ answer }) => answer === form.info[key])!.value}
                  onChange={(event) => changeInfo({ [key]: ANSWERS.find(({ value }) => value === event.target.value)!.answer })}
                >
                  {ANSWERS.map(({ value, label }) => (
                    <option key={value} value={value}>{t(label)}</option>
                  ))}
                </select>
              </label>
            ))}
            <div className="ef-field" role="group" aria-labelledby="assistant-payments">
              <span id="assistant-payments" className="ef-field__label">{t('assistant.payments')}</span>
              <div className="fr-weekdays">
                {PAYMENT_METHODS.map(({ id }) => (
                  <label key={id} className="ef-choice">
                    <input
                      type="checkbox"
                      className="ef-check"
                      checked={form.info.payments.includes(id)}
                      onChange={(event) => togglePayment(id, event.target.checked)}
                    />
                    {t(`assistant.payment.${id}`)}
                  </label>
                ))}
              </div>
            </div>
            <p className="ef-field__hint">{t('assistant.knowsHint')}</p>
          </div>

          <div className="ef-card">
            <h2 className="title-md">{t('assistant.hoursTitle')}</h2>
            <p className="ef-card__text">{t('assistant.hoursText')}</p>
            <div className="fr-weekdays">
              {WEEK.map((day, index) => (
                <label key={day} className="ef-choice">
                  <input
                    type="checkbox"
                    className="ef-check"
                    checked={form.openDays.includes(day)}
                    onChange={(event) => toggleDay(day, event.target.checked)}
                  />
                  {tl('assistant.week')[index]}
                </label>
              ))}
            </div>
            <div className="fr-hours">
              <label className="ef-field">
                <span className="ef-field__label">{t('assistant.opensAt')}</span>
                <input className="ef-input" type="time" value={form.opensAt} onChange={(event) => change({ opensAt: event.target.value })} />
              </label>
              <label className="ef-field">
                <span className="ef-field__label">{t('assistant.closesAt')}</span>
                <input className="ef-input" type="time" value={form.closesAt} onChange={(event) => change({ closesAt: event.target.value })} />
              </label>
            </div>
          </div>

          <div className="ef-card">
            <h2 className="title-md">{t('assistant.lostTitle')}</h2>
            <label className="ef-choice">
              <input
                type="checkbox"
                role="switch"
                className="ef-switch"
                checked={form.reactivationEnabled}
                onChange={(event) => change({ reactivationEnabled: event.target.checked })}
              />
              {t('assistant.autoCall')}
            </label>
            <p className="ef-card__text">
              {tp('assistant.queue', inQueue, { days: inactiveDays, limit: dailyLimit })}
            </p>
            <p className="ef-field__hint">{t('assistant.lostHint')}</p>
          </div>

          {formError && <p className="ef-alert ef-alert--danger" role="alert">{formError}</p>}
          {saved && <p className="ef-alert ef-alert--success" role="status">{t('assistant.saved')}</p>}
          <button type="submit" className="ef-button ef-button--primary">{t('common.save')}</button>
        </form>

        <AssistantTest customers={customers} onFailure={onFailure} onDataChanged={onDataChanged} />
      </div>
    </section>
  )
}

interface TestProps {
  customers: EndCustomer[]
  onFailure: (failure: unknown) => void
  onDataChanged: () => void
}

function AssistantTest({ customers, onFailure, onDataChanged }: TestProps) {
  const [lines, setLines] = useState<ChatLine[]>([])
  const [text, setText] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [newPhone, setNewPhone] = useState('')
  const [phoneError, setPhoneError] = useState('')
  const [waiting, setWaiting] = useState(false)
  const scroller = useRef<HTMLDivElement>(null)
  const { t } = usePreferences()
  const phone = customerPhone || normalizeBrPhone(newPhone)

  useEffect(() => {
    const box = scroller.current
    if (box) box.scrollTop = box.scrollHeight
  }, [lines, waiting])

  async function send(event: FormEvent) {
    event.preventDefault()
    const message = text.trim()
    if (!message || waiting) return
    if (!phone) {
      setPhoneError(t('assistant.phoneRequired'))
      return
    }
    setPhoneError('')
    setText('')
    setWaiting(true)
    setLines((current) => [...current, { from: 'cliente', text: message }])
    try {
      const { reply, trail } = await api<{ reply: string; trail: string[] }>('/workspace/assistant/test', {
        body: { text: message, phone },
      })
      const steps = trail.map((item): ChatLine => ({ from: 'sistema', text: item }))
      setLines((current) => [...current, ...steps, { from: 'atendente', text: reply }])
      if (trail.length) onDataChanged()
    } catch (failure) {
      if (failure instanceof ApiError && failure.code === 'ia_desligada') {
        setLines((current) => [...current, { from: 'sistema', text: t('assistant.aiOff') }])
      } else {
        onFailure(failure)
      }
    } finally {
      setWaiting(false)
    }
  }

  async function restart(target: string | null = phone) {
    setLines([])
    if (target) await api(`/workspace/assistant/test?phone=${target}`, { method: 'DELETE' }).catch(onFailure)
  }

  function changeCustomer(value: string) {
    void restart()
    setCustomerPhone(value)
    setPhoneError('')
  }

  return (
    <div className="ef-card">
      <div className="fr-spread">
        <h2 className="title-md">{t('assistant.testTitle')}</h2>
        <button type="button" className="ef-button ef-button--ghost ef-button--sm" onClick={() => restart()}>
          {t('assistant.restart')}
        </button>
      </div>
      <label className="ef-field">
        <span className="ef-field__label">{t('assistant.who')}</span>
        <select className="ef-input" value={customerPhone} onChange={(event) => changeCustomer(event.target.value)}>
          <option value="">{t('assistant.newNumber')}</option>
          {customers.map((customer) => (
            <option key={customer.phone} value={customer.phone}>{customer.name}</option>
          ))}
        </select>
      </label>
      {!customerPhone && (
        <label className="ef-field">
          <span className="ef-field__label">{t('assistant.whoPhone')}</span>
          <input
            className="ef-input"
            inputMode="tel"
            placeholder="(11) 91234-5678"
            value={newPhone}
            aria-invalid={phoneError ? true : undefined}
            onChange={(event) => setNewPhone(event.target.value)}
          />
          {phoneError ? (
            <span className="ef-field__error">{phoneError}</span>
          ) : (
            <span className="ef-field__hint">{t('assistant.newHint')}</span>
          )}
        </label>
      )}
      <div ref={scroller} className="fr-chat" aria-live="polite">
        {lines.length === 0 && <p className="ef-card__text">{t('assistant.emptyChat')}</p>}
        {lines.map((line, index) => (
          <p key={index} className={`fr-chat__line fr-chat__line--${line.from}`}>
            {line.text}
          </p>
        ))}
        {waiting && <p className="fr-chat__line fr-chat__line--sistema">{t('assistant.writing')}</p>}
      </div>
      <form className="fr-chat__form" onSubmit={send}>
        <label className="fr-sr-only" htmlFor="assistant-test">{t('assistant.messageLabel')}</label>
        <input
          id="assistant-test"
          className="ef-input"
          maxLength={500}
          autoComplete="off"
          placeholder={t('assistant.messagePlaceholder')}
          value={text}
          onChange={(event) => setText(event.target.value)}
        />
        <button type="submit" className="ef-button ef-button--primary" disabled={waiting || !text.trim()}>{t('assistant.send')}</button>
      </form>
      <p className="ef-field__hint">{t('assistant.testHint')}</p>
    </div>
  )
}
