const OPTIONS = [
  { value: '', label: 'All' },
  { value: 'backlog', label: 'Backlog' },
  { value: 'active', label: 'Active' },
  { value: 'done', label: 'Done' },
]

export default function StatusFilter({ value, onChange }) {
  return (
    <div className="status-filter">
      {OPTIONS.map((o) => (
        <button
          key={o.value}
          className={value === o.value ? 'active' : ''}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
