import Modal from './Modal.jsx'

export default function ConfirmModal({ message, confirmLabel = 'Confirm', onConfirm, onCancel }) {
  return (
    <Modal onClose={onCancel} label={message}>
      <p>{message}</p>
      <div className="modal-actions">
        <button onClick={onCancel}>Cancel</button>
        <button className="btn-danger" onClick={onConfirm}>{confirmLabel}</button>
      </div>
    </Modal>
  )
}
