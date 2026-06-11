import { useState } from 'react'

export default function TagInput({ value, onChange }) {
  const [text, setText] = useState('')

  function addTag(e) {
    e.preventDefault()
    const t = text.trim().replace(/^#/, '').toLowerCase()
    if (!t || value.includes(t)) { setText(''); return }
    onChange([...value, t])
    setText('')
  }

  function removeTag(tag) {
    onChange(value.filter((t) => t !== tag))
  }

  return (
    <div>
      {value.map((t) => (
        <button key={t} type="button" aria-label={`remove ${t}`} onClick={() => removeTag(t)}>
          #{t} ✕
        </button>
      ))}
      <form onSubmit={addTag} style={{ display: 'inline' }}>
        <input placeholder="add tag" value={text} onChange={(e) => setText(e.target.value)} />
      </form>
    </div>
  )
}
