interface Props {
  title: string
  text: string
  action?: { label: string; onClick: () => void }
}

export function Empty({ title, text, action }: Props) {
  return (
    <section className="ef-empty">
      <h1 className="ef-empty__title">{title}</h1>
      <p>{text}</p>
      {action && (
        <button type="button" className="ef-button ef-button--primary" onClick={action.onClick}>
          {action.label}
        </button>
      )}
    </section>
  )
}
