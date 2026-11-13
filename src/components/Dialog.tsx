import { useEffect, useRef, type ReactNode } from 'react'

interface Props {
  title: string
  onClose: () => void
  children: ReactNode
}

export function Dialog({ title, onClose, children }: Props) {
  const dialog = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const element = dialog.current
    if (element && !element.open) element.showModal()
    return () => element?.close()
  }, [])

  return (
    <dialog ref={dialog} className="ef ef-modal" aria-label={title} onCancel={onClose}>
      <h3 className="ef-modal__title">{title}</h3>
      {children}
    </dialog>
  )
}
