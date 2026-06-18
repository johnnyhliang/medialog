export default function VersionHistory({ versions, onRestore }) {
  if (versions.length === 0) return <p className="muted">No past versions yet.</p>
  return (
    <ul className="versions">
      {versions.map((v) => (
        <li key={v.id}>
          <span className="version-date">{new Date(v.created_at).toLocaleString()}</span>
          <span className="version-preview">{v.note.slice(0, 80) || '(empty)'}</span>
          <button onClick={() => onRestore(v.note)}>Restore</button>
        </li>
      ))}
    </ul>
  )
}
