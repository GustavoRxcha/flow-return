import { useEffect, useRef } from 'react'

interface Props {
  title: string
  text: string
  confirmLabel: string
  onConfirm: () => void
  onClose: () => void
}

export function ConfirmDialog({ title, text, confirmLabel, onConfirm, onClose }: Props) {
  const dialog = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const element = dialog.current
    if (element && !element.open) element.showModal()
    return () => element?.close()
  }, [])

  return (
    <dialog ref={dialog} className="ef ef-modal" aria-labelledby="confirm-title" onCancel={onClose}>
      <h3 className="ef-modal__title" id="confirm-title">{title}</h3>
      <p className="ef-modal__text">{text}</p>
      <div className="ef-modal__actions">
        <button type="button" className="ef-button ef-button--secondary" onClick={onClose}>
          Cancelar
        </button>
        <button type="button" className="ef-button ef-button--danger" onClick={onConfirm}>
          {confirmLabel}
        </button>
      </div>
    </dialog>
  )
}
