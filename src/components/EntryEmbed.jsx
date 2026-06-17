import { useEffect, useRef, useState } from 'react'
import { classifyUrl } from '../lib/classifyUrl.js'
import { getYouTubeThumbnail, isYouTubeUrl } from '../lib/youtube.js'

function iconFor(entry) {
  if (!entry) return '⚠'
  if (entry.url && isYouTubeUrl(entry.url)) return '🎥'
  const t = entry.url ? classifyUrl(entry.url) : null
  if (t === 'pdf') return '📄'
  if (t === 'image') return '🖼'
  if (t === 'drive') return '🔗'
  if (entry.url) return '🔗'
  return '📝'
}

function popoverMedia(entry) {
  if (!entry?.url) return null
  if (isYouTubeUrl(entry.url)) return getYouTubeThumbnail(entry.url)
  if (classifyUrl(entry.url) === 'image') return entry.url
  return null
}

const LONG_PRESS_MS = 400

export default function EntryEmbed({ entryId, label, getEntry, onJump }) {
  const entry = getEntry(entryId)
  const [pop, setPop] = useState(null) // {x, y} or null
  const pressTimer = useRef(null)
  const chipRef = useRef(null)

  useEffect(() => {
    return () => { if (pressTimer.current) clearTimeout(pressTimer.current) }
  }, [])

  if (!entry) {
    return <span className="entry-embed missing">⚠ missing entry</span>
  }

  function cancelPress() {
    if (pressTimer.current) { clearTimeout(pressTimer.current); pressTimer.current = null }
  }

  function showPopover() {
    const rect = chipRef.current?.getBoundingClientRect()
    if (rect) setPop({ x: rect.left, y: rect.bottom + 6 })
  }
  function hidePopover() { setPop(null) }

  function onClick() {
    hidePopover()
    onJump(entryId)
  }
  function onTouchStart() {
    pressTimer.current = setTimeout(showPopover, LONG_PRESS_MS)
  }
  function onTouchEnd() { cancelPress() }

  const media = popoverMedia(entry)
  const text = (entry.note || '').split('\n').filter(Boolean).slice(0, 4).join('\n').slice(0, 200)

  return (
    <>
      <button
        ref={chipRef}
        className="entry-embed"
        onClick={onClick}
        onMouseEnter={showPopover}
        onMouseLeave={hidePopover}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        onTouchCancel={cancelPress}
      >
        {iconFor(entry)} {label || entry.title}
      </button>
      {pop && (
        <div className="embed-popover" style={{ left: pop.x, top: pop.y }}>
          <div className="pop-title">{entry.title}</div>
          {media && <img src={media} alt="" loading="lazy" onError={(e) => { e.target.style.display = 'none' }} />}
          {text && <div className="pop-text">{text}</div>}
        </div>
      )}
    </>
  )
}
