import { useState } from 'react'
import {
  Home, Search, Upload, Archive, Inbox, Briefcase, Highlighter,
  RotateCcw, BarChart2, BookOpen, Settings2, Trash2 as TrashIcon, FolderOpen,
  Rss, ScrollText, ChevronRight, Sparkles, GraduationCap, BookMarked,
} from 'lucide-react'

// Declarative nav config, grouped by how often each view is reached for.
// `side` runs an extra loader when navigating (e.g. fetch inbox). The "more"
// group is collapsed by default so daily views stay above the fold. Backup
// import/export and the one-off migration importer live in Settings > Data &
// Backup instead of here — they're occasional, not daily navigation.
const SECTIONS = [
  {
    id: 'daily',
    items: [
      { view: 'home', label: 'Home', icon: Home },
      { view: 'explore', label: 'Explore', icon: Search },
      { view: 'feed', label: 'Feed', icon: Rss, module: 'feed' },
      { view: 'sort', label: 'Sort Inbox', icon: Inbox, side: 'loadInbox' },
      { view: 'tidy', label: 'Tidy', icon: Sparkles, module: 'tidy' },
      { view: 'career', label: 'Career', icon: Briefcase, module: 'career' },
      { view: 'interview', label: 'Interview Prep', icon: GraduationCap, module: 'interview' },
    ],
  },
  {
    id: 'library',
    label: 'library',
    items: [
      { view: 'reading', label: 'Reading', icon: BookMarked, module: 'reading' },
      { view: 'highlights', label: 'Highlights', icon: Highlighter, module: 'highlights' },
      { view: 'revisit', label: 'Revisit', icon: RotateCcw, side: 'loadRevisit', module: 'revisit' },
      { view: 'digest', label: 'Digest', icon: ScrollText, badge: 'digestStale', module: 'digest' },
      { view: 'archive', label: 'Archive', icon: Archive, module: 'archive' },
      { view: 'files', label: 'Files', icon: FolderOpen, module: 'files' },
      { view: 'progress', label: 'Progress', icon: BarChart2, module: 'progress' },
    ],
  },
  {
    id: 'more',
    label: 'more',
    collapsible: true,
    items: [
      { view: 'bulk', label: 'Bulk Import', icon: Upload, module: 'import' },
      { view: 'guide', label: 'Guide', icon: BookOpen },
      { view: 'settings', label: 'Settings', icon: Settings2 },
      { view: 'trash', label: 'Trash', icon: TrashIcon, side: 'loadTrash' },
      { view: 'metrics', label: 'Metrics', icon: BarChart2, module: 'metrics' },
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

export default function NavSidebar({ view, navigateTo, sideEffects = {}, isModuleVisible = () => true }) {
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
        // Items declaring a `module` are shown only when that module passes the
        // composed entitlement+preference check (src/lib/modules.js). Items with
        // no `module` are unconditional.
        const items = section.items.filter((i) => !i.module || isModuleVisible(i.module))
        if (!items.length) return null
        // keep the "more" group visible when its current view is active,
        // otherwise the active highlight would be hidden
        const containsActive = items.some((i) => i.view === view)
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
            {open && <ul className="nav-section-items">{items.map(renderItem)}</ul>}
          </li>
        )
      })}
    </ul>
  )
}
