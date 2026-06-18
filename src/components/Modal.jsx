import { useEffect, useRef } from 'react'

export default function Modal({ children, onClose, maxWidth = '420px', label }) {
  const overlayRef = useRef(null)

  useEffect(() => {
    const prev = document.activeElement
    function onKey(e) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      if (prev && typeof prev.focus === 'function') prev.focus()
    }
  }, [onClose])

  return (
    <div
      className="modal-backdrop"
      ref={overlayRef}
      onClick={(e) => { if (e.target === overlayRef.current) onClose() }}
    >
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label={label}
        style={{ maxWidth }}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  )
}
