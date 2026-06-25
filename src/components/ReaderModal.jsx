import { useEffect, useRef } from 'react'

export default function ReaderModal({ entry, onClose }) {
  const overlayRef = useRef(null)

  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  function onOverlayClick(e) {
    if (e.target === overlayRef.current) onClose()
  }

  const paragraphs = (entry.full_text || '').split(/\n{2,}/)

  return (
    <div className="reader-overlay" ref={overlayRef} onClick={onOverlayClick}>
      <div className="reader-modal">
        <div className="reader-header">
          <div className="reader-title">{entry.title || entry.url}</div>
          <div className="reader-header-actions">
            {entry.url && (
              <a href={entry.url} target="_blank" rel="noreferrer" className="reader-orig-link">
                View original ↗
              </a>
            )}
            <button className="reader-close" onClick={onClose} aria-label="Close reader">✕</button>
          </div>
        </div>
        <div className="reader-body">
          {paragraphs.map((p, i) => (
            <p key={i}>{p.trim()}</p>
          ))}
        </div>
      </div>
    </div>
  )
}
