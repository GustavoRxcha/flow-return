import { useState, type ChangeEvent } from 'react'
import { todayIso } from '../lib/dates'
import { parseEndCustomerTable, type ImportResult } from '../lib/table'

interface Props {
  onImport: (text: string) => Promise<boolean>
}

export function ImportPanel({ onImport }: Props) {
  const [text, setText] = useState('')
  const [fileError, setFileError] = useState('')
  const [done, setDone] = useState(false)
  const result: ImportResult | null = text.trim() ? parseEndCustomerTable(text, todayIso()) : null

  async function readFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    if (/\.xlsx?$/i.test(file.name)) {
      setFileError('Salve a planilha como CSV e envie de novo, ou copie as células e cole aqui.')
      return
    }
    setFileError('')
    setText(await file.text())
  }

  return (
    <section className="ef-stack">
      <label className="ef-field">
        <span className="ef-field__label">Lista de clientes</span>
        <textarea
          className="ef-input"
          rows={6}
          placeholder={'nome;telefone;última visita;serviço\nAna Souza;(11) 91234-5678;12/08/2026;Corte'}
          value={text}
          onChange={(event) => setText(event.target.value)}
        />
      </label>

      <label className="ef-button ef-button--secondary ef-button--full">
        Enviar arquivo CSV
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
      {done && !result && <p className="ef-alert ef-alert--success" role="status"><span className="ef-alert__title">Pronto.</span> Lista atualizada.</p>}

      <p className="ef-alert">A lista fica guardada na sua conta. Só você tem acesso aos nomes e telefones.</p>
    </section>
  )
}

function ImportSummary({ result, onConfirm }: { result: ImportResult; onConfirm: () => void }) {
  const { customers, issues, missingColumns } = result

  if (missingColumns.length > 0) {
    return <p className="ef-alert ef-alert--danger" role="alert">Faltam as colunas: {missingColumns.join(', ')}.</p>
  }

  return (
    <div className="ef-stack">
      <p className="ef-alert ef-alert--success" role="status">
        {customers.length === 1 ? '1 cliente pronto' : `${customers.length} clientes prontos`}
        {issues.length > 0 && ` · ${issues.length} ${issues.length === 1 ? 'linha ignorada' : 'linhas ignoradas'}`}
      </p>
      {issues.length > 0 && (
        <ul className="ef-list">
          {issues.slice(0, 5).map((issue) => (
            <li key={issue.line} className="ef-item">
              <span className="ef-item__meta">Linha {issue.line}: {issue.reason}</span>
            </li>
          ))}
          {issues.length > 5 && <li className="ef-item"><span className="ef-item__meta">E mais {issues.length - 5}.</span></li>}
        </ul>
      )}
      {customers.length > 0 && (
        <button type="button" className="ef-button ef-button--brand ef-button--full" onClick={onConfirm}>
          Usar esta lista
        </button>
      )}
    </div>
  )
}
