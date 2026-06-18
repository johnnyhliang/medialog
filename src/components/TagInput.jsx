import { useState } from 'react'

export default function TagInput({ value, onChange, tagColors }) {
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
    <div className="tags">
      {value.map((t) => (
        <button key={t} type="button" className="tag-chip" aria-label={`remove ${t}`} onClick={() => removeTag(t)} style={{ background: tagColors?.[t] || undefined }}>
          #{t} ✕
        </button>
      ))}
      <form onSubmit={addTag} style={{ display: 'inline' }}>
        <input className="tag-add" placeholder="add tag" value={text} onChange={(e) => setText(e.target.value)} />
      </form>
    </div>
  )
}
