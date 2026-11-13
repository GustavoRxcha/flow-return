import { PLANS } from '../lib/plans'
import type { AppState, PlanId } from '../lib/types'
import { DEFAULT_TEMPLATE } from '../lib/types'
import { ImportPanel } from './ImportPanel'
import { ProfessionalsPanel } from './ProfessionalsPanel'
import type { Dispatch } from './ReturnClientApp'

interface Props {
  state: AppState
  plan: PlanId
  dispatch: Dispatch
  onImport: (text: string) => Promise<boolean>
  onFailure: (failure: unknown) => void
}

export function SettingsPanel({ state, plan, dispatch, onImport, onFailure }: Props) {
  const { settings } = state
  const change = (partial: Partial<AppState['settings']>) =>
    dispatch({ type: 'settings', settings: partial })

  return (
    <section className="fr-stack-lg">
      <h1 className="title-lg">Ajustes</h1>

      <div className="ef-card ef-card--panel">
        <div>
          <p className="ef-stat__label">Seu plano</p>
          <p className="ef-card__title">{PLANS[plan].name}</p>
        </div>
        <ul className="ef-list">
          {PLANS[plan].features.map((feature) => (
            <li key={feature.label} className={feature.available ? 'ef-item ef-item--done' : 'ef-item'}>
              <span className="ef-item__mark">
                {feature.available && (
                  <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">
                    <path
                      d="M5 12.5l4.5 4.5L19 7"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="3.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                )}
              </span>
              <span className="ef-item__body">
                <span className="ef-item__title">{feature.label}</span>
              </span>
              {!feature.available && <span className="ef-badge">Em breve</span>}
            </li>
          ))}
        </ul>
      </div>

      <TextSetting
        label="Nome do negócio"
        value={settings.businessName}
        onSave={(businessName) => change({ businessName })}
      />

      <ProfessionalsPanel onFailure={onFailure} />

      <div className="ef-stats">
        <NumberField
          label="Sumido depois de (dias)"
          value={settings.inactiveDays}
          onChange={(inactiveDays) => change({ inactiveDays })}
        />
        <NumberField
          label="Limite por dia"
          value={settings.dailyLimit}
          onChange={(dailyLimit) => change({ dailyLimit })}
        />
      </div>

      <TextSetting
        multiline
        label="Mensagem padrão"
        value={settings.template}
        onSave={(template) => change({ template })}
      />
      <p className="ef-field__hint">Use {'{nome}'}, {'{negocio}'}, {'{tempo}'} e {'{servico}'}.</p>
      {settings.template !== DEFAULT_TEMPLATE && (
        <button type="button" className="ef-button ef-button--ghost ef-button--sm" onClick={() => change({ template: DEFAULT_TEMPLATE })}>
          Voltar à mensagem original
        </button>
      )}

      <h2 className="title-md">Atualizar a lista</h2>
      <ImportPanel onImport={onImport} />
    </section>
  )
}

function TextSetting({
  label,
  value,
  multiline,
  onSave,
}: {
  label: string
  value: string
  multiline?: boolean
  onSave: (value: string) => void
}) {
  const save = (next: string) => {
    if (next.trim() && next !== value) onSave(next)
  }
  return (
    <label className="ef-field">
      <span className="ef-field__label">{label}</span>
      {multiline ? (
        <textarea className="ef-input" key={value} rows={6} defaultValue={value} onBlur={(event) => save(event.target.value)} />
      ) : (
        <input className="ef-input" key={value} defaultValue={value} onBlur={(event) => save(event.target.value)} />
      )}
    </label>
  )
}

function NumberField({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return (
    <label className="ef-field">
      <span className="ef-field__label">{label}</span>
      <input
        className="ef-input"
        key={value}
        type="number"
        min={1}
        defaultValue={value}
        onBlur={(event) => {
          const next = Number(event.target.value)
          if (Number.isInteger(next) && next >= 1 && next !== value) onChange(next)
        }}
      />
    </label>
  )
}
