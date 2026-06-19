import Modal from './Modal.jsx'

export default function ExportModal({ exportModal, topics, onConfirm, onClose }) {
  return (
    <Modal onClose={onClose} label="Export library" maxWidth="400px">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '4px 0' }}>
        {exportModal.loading ? (
          <p className="muted" style={{ fontSize: 13 }}>Calculating export size…</p>
        ) : (
          <>
            <p style={{ fontSize: 14, margin: 0 }}>
              Export <strong>{exportModal.entryCount ?? '—'} entries</strong> across <strong>{topics.length} topics</strong> as a zip of Markdown files.
            </p>
            <p className="muted" style={{ fontSize: 13, margin: 0 }}>
              Estimated size: <strong>~{exportModal.estimatedKB != null
                ? exportModal.estimatedKB >= 1024
                  ? `${(exportModal.estimatedKB / 1024).toFixed(1)} MB`
                  : `${exportModal.estimatedKB} KB`
                : '—'}</strong> (compressed)
            </p>
            <p className="muted" style={{ fontSize: 12, margin: 0 }}>
              Note: file attachments (images, PDFs) are stored in Supabase and are not included in this export.
            </p>
          </>
        )}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button className="btn-small btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-small" onClick={onConfirm} disabled={exportModal.loading}>
            {exportModal.loading ? 'Calculating…' : 'Export'}
          </button>
        </div>
      </div>
    </Modal>
  )
}
