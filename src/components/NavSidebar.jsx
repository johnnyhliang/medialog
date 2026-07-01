import {
  Home, Search, Upload, PackageOpen, Archive, Inbox, Briefcase, Highlighter,
  RotateCcw, BarChart2, BookOpen, Settings2, Trash2 as TrashIcon, FolderOpen,
  Rss, ScrollText, Download,
} from 'lucide-react'

// Declarative nav config. Each item maps a view id to its icon/label; `side`
// runs an extra loader when navigating (e.g. fetch inbox). `action` items are
// buttons that don't select a view (Export). This replaces ~95 lines of
// near-identical <li><button> markup that previously lived in App.jsx.
const ITEMS = [
  { view: 'home', label: 'Home', icon: Home },
  { view: 'explore', label: 'Explore', icon: Search },
  { view: 'bulk', label: 'Bulk Import', icon: Upload },
  { view: 'migration', label: 'Import', icon: PackageOpen },
  { view: 'archive', label: 'Archive', icon: Archive },
  { view: 'sort', label: 'Sort Inbox', icon: Inbox, side: 'loadInbox' },
  { view: 'career', label: 'Career', icon: Briefcase },
  { view: 'highlights', label: 'Highlights', icon: Highlighter },
  { view: 'revisit', label: 'Revisit', icon: RotateCcw, side: 'loadRevisit' },
  { view: 'progress', label: 'Progress', icon: BarChart2 },
  { view: 'guide', label: 'Guide', icon: BookOpen },
  { view: 'settings', label: 'Settings', icon: Settings2 },
  { view: 'trash', label: 'Trash', icon: TrashIcon, side: 'loadTrash' },
  { view: 'files', label: 'Files', icon: FolderOpen },
  { view: 'feed', label: 'Feed', icon: Rss },
  { view: 'digest', label: 'Digest', icon: ScrollText, badge: 'digestStale' },
  { action: 'export', label: 'Export', icon: Download },
]

function digestStale() {
  try {
    const last = localStorage.getItem('medialog_digest_last_viewed')
    return !last || Date.now() - Number(last) > 7 * 24 * 60 * 60 * 1000
  } catch {
    return false
  }
}

export default function NavSidebar({ view, navigateTo, sideEffects = {}, onExport }) {
  return (
    <ul className="nav">
      {ITEMS.map((item) => {
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
      })}
    </ul>
  )
}
