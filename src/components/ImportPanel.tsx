import { useState, type ChangeEvent } from 'react'
import { todayIso } from '../lib/dates'
import type { MessageKey } from '../lib/i18n'
import { parseEndCustomerTable, type ImportIssue, type ImportResult } from '../lib/table'
import { usePreferences } from './Preferences'

/** Nomes de coluna que o leitor da lista devolve, em português. */
const COLUMN_KEYS: Record<string, MessageKey> = {
  nome: 'import.column.name',
  telefone: 'import.column.phone',
  'última visita': 'import.column.lastVisit',
  serviço: 'import.column.service',
}

const ISSUE_KEYS: Record<ImportIssue['kind'], MessageKey> = {
  noName: 'import.issue.noName',
  phone: 'import.issue.phone',
  date: 'import.issue.date',
  future: 'import.issue.future',
}

interface Props {
  onImport: (text: string) => Promise<boolean>
}

export function ImportPanel({ onImport }: Props) {
  const [text, setText] = useState('')
  const [fileError, setFileError] = useState('')
  const [done, setDone] = useState(false)
  const { t } = usePreferences()
  const result: ImportResult | null = text.trim() ? parseEndCustomerTable(text, todayIso()) : null

  async function readFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    if (/\.xlsx?$/i.test(file.name)) {
      setFileError(t('import.xls'))
      return
    }
    setFileError('')
    setText(await file.text())
  }

  return (
    <section className="ef-stack">
      <label className="ef-field">
        <span className="ef-field__label">{t('import.label')}</span>
        <textarea
          className="ef-input"
          rows={6}
          placeholder={t('import.placeholder')}
          value={text}
          onChange={(event) => setText(event.target.value)}
        />
      </label>

      <label className="ef-button ef-button--secondary ef-button--full">
        {t('import.file')}
        <input className="fr-sr-only" type="file" accept=".csv,.txt,.tsv,.xls,.xlsx" onChange={readFile} />
      </label>
      {fileError && <p className="ef-alert ef-alert--danger" role="alert">{fileError}</p>}

      {result && (
        <ImportSummary
          result={result}
          onConfirm={async () => {
            if (await onImport(text)) {
              setText('')
              setDone(true)
            }
          }}
        />
      )}
      {done && !result && <p className="ef-alert ef-alert--success" role="status"><span className="ef-alert__title">{t('common.done')}</span> {t('import.updated')}</p>}

      <p className="ef-alert">{t('import.privacy')}</p>
    </section>
  )
}

function ImportSummary({ result, onConfirm }: { result: ImportResult; onConfirm: () => void }) {
  const { customers, issues, missingColumns } = result
  const { t, tp } = usePreferences()

  if (missingColumns.length > 0) {
    return <p className="ef-alert ef-alert--danger" role="alert">{t('import.missing', { columns: missingColumns.map((column) => (COLUMN_KEYS[column] ? t(COLUMN_KEYS[column]) : column)).join(', ') })}</p>
  }

  return (
    <div className="ef-stack">
      <p className="ef-alert ef-alert--success" role="status">
        {tp('import.ready', customers.length)}
        {issues.length > 0 && ` · ${tp('import.ignored', issues.length)}`}
      </p>
      {issues.length > 0 && (
        <ul className="ef-list">
          {issues.slice(0, 5).map((issue) => (
            <li key={issue.line} className="ef-item">
              <span className="ef-item__meta">{t('import.line', { line: issue.line, reason: t(ISSUE_KEYS[issue.kind], { name: issue.name ?? '' }) })}</span>
            </li>
          ))}
          {issues.length > 5 && <li className="ef-item"><span className="ef-item__meta">{t('import.more', { n: issues.length - 5 })}</span></li>}
        </ul>
      )}
      {customers.length > 0 && (
        <button type="button" className="ef-button ef-button--brand ef-button--full" onClick={onConfirm}>
          {t('import.use')}
        </button>
      )}
    </div>
  )
}
