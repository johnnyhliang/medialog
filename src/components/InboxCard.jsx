// src/components/InboxCard.jsx
import { Inbox, CheckCircle } from 'lucide-react'

export default function InboxCard({ count, onSortInbox }) {
  return (
    <div className="inbox-card">
      <div className="inbox-card-left">
        <Inbox size={18} className="inbox-card-icon" />
        <span className="inbox-card-name">Inbox</span>
        {count > 0 && <span className="inbox-card-badge">{count}</span>}
      </div>
      {count > 0 ? (
        <button className="btn-small" onClick={onSortInbox}>Sort now →</button>
      ) : (
        <span className="inbox-card-clear muted">
          <CheckCircle size={14} /> All clear
        </span>
      )}
    </div>
  )
}
