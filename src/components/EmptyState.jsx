export default function EmptyState({ message, action }) {
  return (
    <div className="empty-state">
      <p className="empty-state-msg">{message}</p>
      {action && (
        <button className="empty-state-action" onClick={action.onClick}>
          {action.label}
        </button>
      )}
    </div>
  )
}
