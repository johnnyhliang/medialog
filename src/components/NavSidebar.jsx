import { useState } from 'react'
import {
  Home, Search, Upload, PackageOpen, Archive, Inbox, Briefcase, Highlighter,
  RotateCcw, BarChart2, BookOpen, Settings2, Trash2 as TrashIcon, FolderOpen,
  Rss, ScrollText, Download, ChevronRight, Sparkles, GraduationCap, BookMarked,
} from 'lucide-react'

// Declarative nav config, grouped by how often each view is reached for.
// `side` runs an extra loader when navigating (e.g. fetch inbox). `action`
// items are buttons that don't select a view (Export). The "more" group is
// collapsed by default so daily views stay above the fold.
const SECTIONS = [
  {
    id: 'daily',
    items: [
      { view: 'home', label: 'Home', icon: Home },
      { view: 'explore', label: 'Explore', icon: Search },
      { view: 'feed', label: 'Feed', icon: Rss },
      { view: 'sort', label: 'Sort Inbox', icon: Inbox, side: 'loadInbox' },
      { view: 'tidy', label: 'Tidy', icon: Sparkles },
      { view: 'career', label: 'Career', icon: Briefcase },
      { view: 'interview', label: 'Interview Prep', icon: GraduationCap },
    ],
  },
  {
    id: 'library',
    label: 'library',
    items: [
      { view: 'reading', label: 'Reading', icon: BookMarked },
      { view: 'highlights', label: 'Highlights', icon: Highlighter },
      { view: 'revisit', label: 'Revisit', icon: RotateCcw, side: 'loadRevisit' },
      { view: 'digest', label: 'Digest', icon: ScrollText, badge: 'digestStale' },
      { view: 'archive', label: 'Archive', icon: Archive },
      { view: 'files', label: 'Files', icon: FolderOpen },
      { view: 'progress', label: 'Progress', icon: BarChart2 },
    ],
  },
  {
    id: 'more',
    label: 'more',
    collapsible: true,
    items: [
      { view: 'bulk', label: 'Bulk Import', icon: Upload },
      { view: 'migration', label: 'Import', icon: PackageOpen },
      { action: 'export', label: 'Export', icon: Download },
      { view: 'guide', label: 'Guide', icon: BookOpen },
      { view: 'settings', label: 'Settings', icon: Settings2 },
      { view: 'trash', label: 'Trash', icon: TrashIcon, side: 'loadTrash' },
    ],
  },
]

const MORE_OPEN_KEY = 'medialog_nav_more_open'

function digestStale() {
  try {
    const last = localStorage.getItem('medialog_digest_last_viewed')
    return !last || Date.now() - Number(last) > 7 * 24 * 60 * 60 * 1000
  } catch {
    return false
  }
}

export default function NavSidebar({ view, navigateTo, sideEffects = {}, onExport }) {
  const [moreOpen, setMoreOpen] = useState(() => {
    try { return localStorage.getItem(MORE_OPEN_KEY) === 'true' } catch { return false }
  })

  function toggleMore() {
    const next = !moreOpen
    setMoreOpen(next)
    try { localStorage.setItem(MORE_OPEN_KEY, next) } catch {}
  }

  function renderItem(item) {
    const Icon = item.icon
    if (item.action === 'export') {
      return (
        <li key="export">
          <button onClick={onExport} title={item.label}>
            <Icon size={16} /><span>{item.label}</span>
          </button>
        </li>
      )
    }
    const showBadge = item.badge === 'digestStale' && digestStale()
    return (
      <li key={item.view}>
        <button
          className={view === item.view ? 'active' : ''}
          title={item.label}
          style={showBadge ? { position: 'relative' } : undefined}
          onClick={() => {
            navigateTo(item.view)
            if (item.side) sideEffects[item.side]?.()
          }}
        >
          <Icon size={16} /><span>{item.label}</span>
          {showBadge && <span className="nav-dot" />}
        </button>
      </li>
    )
  }

  return (
    <ul className="nav">
      {SECTIONS.map((section) => {
        // keep the "more" group visible when its current view is active,
        // otherwise the active highlight would be hidden
        const containsActive = section.items.some((i) => i.view === view)
        const open = !section.collapsible || moreOpen || containsActive
        return (
          <li key={section.id} className="nav-section">
            {section.label && !section.collapsible && (
              <p className="nav-section-label">{section.label}</p>
            )}
            {section.collapsible && (
              <button className="nav-section-toggle" onClick={toggleMore} aria-expanded={open}>
                <ChevronRight size={12} className={`nav-section-chevron${open ? ' open' : ''}`} />
                <span>{section.label}</span>
              </button>
            )}
            {open && <ul className="nav-section-items">{section.items.map(renderItem)}</ul>}
          </li>
        )
      })}
    </ul>
  )
}
