import { useEffect, useRef } from 'react'

export default function Modal({ children, onClose, maxWidth = '420px', label }) {
  const overlayRef = useRef(null)

  // Capture focused element on mount; restore on unmount (separate from onClose dep)
  useEffect(() => {
    const prev = document.activeElement
    return () => {
      if (prev && typeof prev.focus === 'function') prev.focus()
    }
  }, [])

  // Re-register keydown listener when onClose changes
  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      className="modal-backdrop"
      ref={overlayRef}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
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
