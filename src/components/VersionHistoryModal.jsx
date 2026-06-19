import Modal from './Modal.jsx'
import VersionHistory from './VersionHistory.jsx'

export default function VersionHistoryModal({ versions, onRestore, onClose }) {
  return (
    <Modal onClose={onClose} label="Version history" maxWidth="560px">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxHeight: '70vh', overflow: 'auto' }}>
        <p className="section-label">Version history</p>
        <VersionHistory versions={versions} onRestore={onRestore} />
        <button onClick={onClose}>Close</button>
      </div>
    </Modal>
  )
}
