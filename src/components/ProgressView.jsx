export default function ProgressView({ topicName, entries }) {
  const count = (s) => entries.filter((e) => e.status === s).length
  return (
    <div>
      <h2>{topicName} — progress</h2>
      <p className="progress-stats">
        <span className="pill" style={{ color: 'var(--done)' }}>Done: {count('done')}</span>
        <span className="pill" style={{ color: 'var(--active)' }}>Active: {count('active')}</span>
        <span className="pill" style={{ color: 'var(--backlog)' }}>Backlog: {count('backlog')}</span>
      </p>
    </div>
  )
}
