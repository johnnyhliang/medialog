import { useEffect, useRef, useState } from 'react'
import { loadOverrides } from '../lib/keybindings.js'

function fuzzy(str, query) {
  const s = str.toLowerCase()
  const q = query.toLowerCase()
  let si = 0
  for (let i = 0; i < q.length; i++) {
    si = s.indexOf(q[i], si)
    if (si === -1) return false
    si++
  }
  return true
}

function getKeyLabel(cmd) {
  const overrides = loadOverrides()
  return overrides[cmd.id] ?? cmd.defaultKey ?? ''
}

export default function CommandPalette({ open, onClose, commands, topics = [] }) {
  const [query, setQuery] = useState('')
  const [selectedIdx, setSelectedIdx] = useState(0)
  const inputRef = useRef(null)

  useEffect(() => {
    if (open) { setQuery(''); setSelectedIdx(0); setTimeout(() => inputRef.current?.focus(), 0) }
  }, [open])

  const topicCommands = topics.map((t) => ({
    id: `nav.topic.${t.id}`,
    label: `Go to ${t.name}`,
    category: 'Topics',
    defaultKey: '',
    handler: () => {},
    _topicId: t.id,
  }))

  const allCommands = [...commands, ...topicCommands]

  const filtered = query.trim()
    ? allCommands.filter((c) => fuzzy(c.label, query))
    : allCommands

  const groups = filtered.reduce((acc, cmd) => {
    if (!acc[cmd.category]) acc[cmd.category] = []
    acc[cmd.category].push(cmd)
    return acc
  }, {})

  const flat = filtered

  useEffect(() => { setSelectedIdx(0) }, [query])

  function handleKey(e) {
    if (e.key === 'Escape') { onClose(); return }
    if (e.key === 'ArrowDown' || e.key === 'j') {
      e.preventDefault()
      setSelectedIdx((i) => Math.min(i + 1, flat.length - 1))
    }
    if (e.key === 'ArrowUp' || e.key === 'k') {
      e.preventDefault()
      setSelectedIdx((i) => Math.max(i - 1, 0))
    }
    if (e.key === 'Tab') {
      e.preventDefault()
      const cats = Object.keys(groups)
      const currentCmd = flat[selectedIdx]
      const currentCatIdx = cats.indexOf(currentCmd?.category)
      const nextCat = e.shiftKey
        ? cats[Math.max(currentCatIdx - 1, 0)]
        : cats[Math.min(currentCatIdx + 1, cats.length - 1)]
      const firstInNextCat = flat.findIndex((c) => c.category === nextCat)
      if (firstInNextCat !== -1) setSelectedIdx(firstInNextCat)
    }
    if (e.key === 'Enter') {
      const cmd = flat[selectedIdx]
      if (cmd) { cmd.handler(); onClose() }
    }
  }

  if (!open) return null

  let flatIdx = 0

  return (
    <div className="palette-overlay" onClick={onClose}>
      <div className="palette-box" onClick={(e) => e.stopPropagation()}>
        <input
          ref={inputRef}
          className="palette-input"
          placeholder="Type a command or topic…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKey}
        />
        <div className="palette-results">
          {Object.entries(groups).map(([cat, cmds]) => (
            <div key={cat} className="palette-group">
              <div className="palette-group-label">{cat}</div>
              {cmds.map((cmd) => {
                const idx = flatIdx++
                const isSelected = idx === selectedIdx
                return (
                  <div
                    key={cmd.id}
                    className={`palette-row${isSelected ? ' palette-row--selected' : ''}`}
                    onClick={() => { cmd.handler(); onClose() }}
                    onMouseEnter={() => setSelectedIdx(idx)}
                  >
                    <span className="palette-row-label">{cmd.label}</span>
                    {getKeyLabel(cmd) && (
                      <kbd className="palette-row-kbd">{getKeyLabel(cmd)}</kbd>
                    )}
                  </div>
                )
              })}
            </div>
          ))}
          {flat.length === 0 && (
            <div className="palette-empty">No results</div>
          )}
        </div>
      </div>
    </div>
  )
}
