import { useEffect, useRef, useState, type FormEvent } from 'react'
import { api, ApiError } from '../lib/api'
import { formatBrPhone, normalizeBrPhone } from '../lib/phone'
import { PAYMENT_METHODS, YES_NO_QUESTIONS, type BusinessInfo, type PaymentMethod, type YesNo } from '../lib/businessInfo'
import type { AssistantSettings, EndCustomer } from '../lib/types'

/** Da segunda ao domingo, como o negócio costuma pensar a semana. */
const WEEK = [
  { day: 1, label: 'Seg' },
  { day: 2, label: 'Ter' },
  { day: 3, label: 'Qua' },
  { day: 4, label: 'Qui' },
  { day: 5, label: 'Sex' },
  { day: 6, label: 'Sáb' },
  { day: 0, label: 'Dom' },
]

const ANSWERS: Array<{ value: string; label: string; answer: YesNo }> = [
  { value: '', label: 'Não informado', answer: null },
  { value: 'sim', label: 'Sim', answer: true },
  { value: 'nao', label: 'Não', answer: false },
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
  const [form, setForm] = useState<(AssistantSettings & { phoneText: string }) | null>(null)
  const [phoneError, setPhoneError] = useState('')
  const [formError, setFormError] = useState('')
  const [saved, setSaved] = useState(false)

  function load(reply: Reply) {
    const { phone } = reply.assistant
    setForm({ ...reply.assistant, phoneText: phone ? formatBrPhone(phone) : '' })
  }

  useEffect(() => {
    api<Reply>('/workspace/assistant').then(load).catch(onFailure)
  }, [onFailure])

  if (!form) return <p className="fr-status">Carregando...</p>

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
    setFormError('')
    if (!form!.openDays.length) return setFormError('Escolha pelo menos um dia de atendimento.')
    if (form!.opensAt >= form!.closesAt) return setFormError('O horário de abrir precisa ser antes do de fechar.')
    const { phoneText, ...settings } = form!
    try {
      load(await api<Reply>('/workspace/assistant', { method: 'PUT', body: { ...settings, phone: phoneText } }))
      setSaved(true)
    } catch (failure) {
      if (failure instanceof ApiError && failure.code === 'telefone_invalido') {
        setPhoneError('Confira o número. Use DDD e telefone, como (11) 91234-5678.')
      } else {
        onFailure(failure)
      }
    }
  }

  return (
    <section className="fr-stack-lg">
      <div className="ef-stack">
        <h1 className="title-lg">Atendente IA</h1>
        <p className="ef-card__text">
          Ela conversa com seus clientes, consulta os serviços e a agenda e marca o horário. Só fala o que está no sistema.
        </p>
      </div>

      <p className="ef-alert">Ainda não está ligada ao WhatsApp. O chat desta tela já funciona de verdade: o que ela marcar ou desmarcar muda sua agenda.</p>

      <div className="fr-assistant">
        <form className="fr-stack-lg" onSubmit={save}>
          <div className="ef-card">
            <h2 className="title-md">Número e nome</h2>
            <label className="ef-field">
              <span className="ef-field__label">Número do WhatsApp da atendente</span>
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
                <span className="ef-field__hint">É o número que a API do WhatsApp vai usar. Seus clientes vão chamar nele.</span>
              )}
            </label>
            <label className="ef-field">
              <span className="ef-field__label">Nome da atendente</span>
              <input
                className="ef-input"
                maxLength={40}
                placeholder="Se ficar vazio, usa o nome do negócio"
                value={form.name}
                onChange={(event) => change({ name: event.target.value })}
              />
              <span className="ef-field__hint">Ela sempre avisa que é uma atendente virtual.</span>
            </label>
          </div>

          <div className="ef-card">
            <h2 className="title-md">Ensine sua atendente</h2>
            <p className="ef-card__text">
              O que ela precisa saber para responder seus clientes. O que ficar sem resposta, ela diz que não tem a informação.
            </p>
            <label className="ef-field">
              <span className="ef-field__label">Endereço do estabelecimento</span>
              <input
                className="ef-input"
                maxLength={160}
                placeholder="Rua das Flores, 120, Centro, São Paulo"
                value={form.info.address}
                onChange={(event) => changeInfo({ address: event.target.value })}
              />
            </label>
            <label className="ef-field">
              <span className="ef-field__label">Ponto de referência</span>
              <input
                className="ef-input"
                maxLength={120}
                placeholder="Ao lado da padaria"
                value={form.info.reference}
                onChange={(event) => changeInfo({ reference: event.target.value })}
              />
            </label>
            {YES_NO_QUESTIONS.map(({ key, question }) => (
              <label key={key} className="ef-field">
                <span className="ef-field__label">{question}</span>
                <select
                  className="ef-input"
                  value={ANSWERS.find(({ answer }) => answer === form.info[key])!.value}
                  onChange={(event) => changeInfo({ [key]: ANSWERS.find(({ value }) => value === event.target.value)!.answer })}
                >
                  {ANSWERS.map(({ value, label }) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </label>
            ))}
            <div className="ef-field" role="group" aria-labelledby="assistant-payments">
              <span id="assistant-payments" className="ef-field__label">Formas de pagamento</span>
              <div className="fr-weekdays">
                {PAYMENT_METHODS.map(({ id, label }) => (
                  <label key={id} className="ef-choice">
                    <input
                      type="checkbox"
                      className="ef-check"
                      checked={form.info.payments.includes(id)}
                      onChange={(event) => togglePayment(id, event.target.checked)}
                    />
                    {label}
                  </label>
                ))}
              </div>
            </div>
            <p className="ef-field__hint">Serviços, valores, profissionais e agenda ela já consulta sozinha.</p>
          </div>

          <div className="ef-card">
            <h2 className="title-md">Horário de atendimento</h2>
            <p className="ef-card__text">Ela só oferece horários dentro destes dias e horas.</p>
            <div className="fr-weekdays">
              {WEEK.map(({ day, label }) => (
                <label key={day} className="ef-choice">
                  <input
                    type="checkbox"
                    className="ef-check"
                    checked={form.openDays.includes(day)}
                    onChange={(event) => toggleDay(day, event.target.checked)}
                  />
                  {label}
                </label>
              ))}
            </div>
            <div className="fr-hours">
              <label className="ef-field">
                <span className="ef-field__label">Abre às</span>
                <input className="ef-input" type="time" value={form.opensAt} onChange={(event) => change({ opensAt: event.target.value })} />
              </label>
              <label className="ef-field">
                <span className="ef-field__label">Fecha às</span>
                <input className="ef-input" type="time" value={form.closesAt} onChange={(event) => change({ closesAt: event.target.value })} />
              </label>
            </div>
          </div>

          <div className="ef-card">
            <h2 className="title-md">Clientes sumidos</h2>
            <label className="ef-choice">
              <input
                type="checkbox"
                role="switch"
                className="ef-switch"
                checked={form.reactivationEnabled}
                onChange={(event) => change({ reactivationEnabled: event.target.checked })}
              />
              Chamar clientes sumidos sozinha
            </label>
            <p className="ef-card__text">
              {inQueue === 1 ? 'Hoje, 1 cliente está na fila' : `Hoje, ${inQueue} clientes estão na fila`} depois de{' '}
              {inactiveDays} dias sem vir. O limite é de {dailyLimit} por dia. Prazo, limite e mensagem ficam em Ajustes.
            </p>
            <p className="ef-field__hint">Só começa quando o WhatsApp estiver ligado. Quem pedir para parar não recebe mais.</p>
          </div>

          {formError && <p className="ef-alert ef-alert--danger" role="alert">{formError}</p>}
          {saved && <p className="ef-alert ef-alert--success" role="status">Configuração salva.</p>}
          <button type="submit" className="ef-button ef-button--primary">Salvar</button>
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
      setPhoneError('Informe um número com DDD, como (11) 91234-5678.')
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
        setLines((current) => [...current, { from: 'sistema', text: 'A IA não respondeu. Abra o Ollama e tente de novo.' }])
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
        <h2 className="title-md">Testar a atendente</h2>
        <button type="button" className="ef-button ef-button--ghost ef-button--sm" onClick={() => restart()}>
          Recomeçar
        </button>
      </div>
      <label className="ef-field">
        <span className="ef-field__label">Quem está escrevendo</span>
        <select className="ef-input" value={customerPhone} onChange={(event) => changeCustomer(event.target.value)}>
          <option value="">Número novo</option>
          {customers.map((customer) => (
            <option key={customer.phone} value={customer.phone}>{customer.name}</option>
          ))}
        </select>
      </label>
      {!customerPhone && (
        <label className="ef-field">
          <span className="ef-field__label">Número de quem escreve</span>
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
            <span className="ef-field__hint">Quem não está na lista entra como cliente novo, com este número.</span>
          )}
        </label>
      )}
      <div ref={scroller} className="fr-chat" aria-live="polite">
        {lines.length === 0 && <p className="ef-card__text">Escreva como um cliente escreveria. Teste perguntas difíceis e veja como ela responde.</p>}
        {lines.map((line, index) => (
          <p key={index} className={`fr-chat__line fr-chat__line--${line.from}`}>
            {line.text}
          </p>
        ))}
        {waiting && <p className="fr-chat__line fr-chat__line--sistema">Escrevendo...</p>}
      </div>
      <form className="fr-chat__form" onSubmit={send}>
        <label className="fr-sr-only" htmlFor="assistant-test">Mensagem de teste</label>
        <input
          id="assistant-test"
          className="ef-input"
          maxLength={500}
          autoComplete="off"
          placeholder="Escreva uma mensagem"
          value={text}
          onChange={(event) => setText(event.target.value)}
        />
        <button type="submit" className="ef-button ef-button--primary" disabled={waiting || !text.trim()}>Enviar</button>
      </form>
      <p className="ef-field__hint">Nenhuma mensagem sai daqui, mas o que ela marcar, desmarcar ou cadastrar vale de verdade.</p>
    </div>
  )
}
