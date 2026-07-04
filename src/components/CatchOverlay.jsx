import { useEffect } from 'react'
import QuickAdd from './QuickAdd.jsx'

// Catch mode: park a thought from anywhere in the app without navigating.
// Always saves to Inbox — classification is triage's job, not capture's.
export default function CatchOverlay({ open, onClose, onAdd, onCheckDuplicate, supabase }) {
  useEffect(() => {
    if (!open) return
    function onKey(e) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="catch-overlay" onClick={onClose}>
      <div className="catch-panel" onClick={(e) => e.stopPropagation()}>
        <div className="catch-header">
          <span className="section-label" style={{ margin: 0 }}>catch → inbox</span>
          <button className="catch-close" onClick={onClose} aria-label="Close">×</button>
        </div>
        <QuickAdd onAdd={onAdd} disabled={false} onCheckDuplicate={onCheckDuplicate} supabase={supabase} />
        <p className="catch-hint">saves to Inbox — sort it later, get back to what you were doing</p>
      </div>
    </div>
  )
}
