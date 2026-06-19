export default function StorageBar({ totalBytes, capBytes }) {
  const pct = Math.min(100, (totalBytes / capBytes) * 100)
  const usedMB = (totalBytes / 1024 / 1024).toFixed(1)
  const capMB = Math.round(capBytes / 1024 / 1024)
  const nearLimit = pct >= 80

  return (
    <div className="storage-bar-wrap">
      <div className="storage-bar-track">
        <div
          className={`storage-bar-fill${nearLimit ? ' storage-bar-warn' : ''}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="storage-bar-label">{usedMB} MB of {capMB} MB used</p>
      {nearLimit && (
        <p className="storage-bar-warning">
          ⚠ Approaching limit — delete files to free space
        </p>
      )}
    </div>
  )
}
