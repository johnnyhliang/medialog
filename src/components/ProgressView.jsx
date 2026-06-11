export default function ProgressView({ topicName, entries }) {
  const count = (s) => entries.filter((e) => e.status === s).length
  return (
    <div>
      <h2>{topicName} — progress</h2>
      <p>Done: {count('done')} · Active: {count('active')} · Backlog: {count('backlog')}</p>
    </div>
  )
}
