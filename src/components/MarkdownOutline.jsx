import { useMemo, useState } from 'react'
import { List } from 'lucide-react'
import { extractHeadings } from '../lib/markdownOutline.js'

// A collapsible "contents" jump list for a markdown body. Scrolls to a heading
// by querying the shared containerRef (so duplicate slugs across notes never
// collide), using the ids rehype-slug set in the rendered MarkdownView.
export default function MarkdownOutline({ source, containerRef, minHeadings = 2 }) {
  const headings = useMemo(() => extractHeadings(source), [source])
  const [open, setOpen] = useState(false)
  if (headings.length < minHeadings) return null

  function jump(e, slug) {
    e.preventDefault()
    e.stopPropagation()
    const root = containerRef?.current ?? document
    const sel = '#' + (window.CSS?.escape ? CSS.escape(slug) : slug)
    root.querySelector(sel)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div className="md-outline" onClick={(e) => e.stopPropagation()}>
      <button
        className="md-outline-toggle"
        onClick={(e) => { e.stopPropagation(); setOpen((v) => !v) }}
        aria-expanded={open}
      >
        <List size={12} /> contents ({headings.length})
      </button>
      {open && (
        <ul className="md-outline-list">
          {headings.map((h, i) => (
            <li key={i} style={{ paddingLeft: `${(h.level - 1) * 12}px` }}>
              <a href={`#${h.slug}`} onClick={(e) => jump(e, h.slug)}>{h.text}</a>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
