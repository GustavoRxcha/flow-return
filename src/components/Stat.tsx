export function Stat({ value, label, result }: { value: number | string; label: string; result?: boolean }) {
  return (
    <div className="ef-card ef-card--panel">
      <p className={result ? 'ef-stat__value fr-result' : 'ef-stat__value'}>{value}</p>
      <p className="ef-stat__label">{label}</p>
    </div>
  )
}
