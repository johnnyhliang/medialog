// Searchable index of every setting, so you can find one by what it does rather
// than by remembering which tab it lives under.
//
// Modelled on Monkeytype / VS Code settings search: typing filters to matching
// settings and shows which section each lives in, instead of only jumping tabs.
// `keywords` carries the words people actually reach for — someone looking for
// "dark mode" should land on Appearance even though the label says "Palette".
//
// This is a hand-maintained index, deliberately. Deriving it from the DOM would
// drift silently as tabs change; a wrong entry here is visible the moment you
// search for it. Keep it in sync when adding a settings surface.

import { getCommands } from './commands.js'
import { FORMATS as MIGRATION_FORMATS } from '../components/MigrationView.jsx'

// The tab list itself, so the index and the UI cannot disagree about which tabs
// exist or which module gates them. SettingsView renders from this and filters
// by isModuleVisible; settingsIndex.test.js asserts every tab has at least one
// searchable entry, which turns "forgot to index a new setting" from a silent
// gap into a failing test.
export const SETTINGS_TABS = [
  { id: 'appearance',  label: 'Appearance' },
  { id: 'data',        label: 'Data & Backup' },
  { id: 'twitter',     label: 'Twitter',       module: 'twitter' },
  { id: 'shared',      label: 'Shared' },
  { id: 'behavior',    label: 'Behavior' },
  { id: 'timezone',    label: 'Timezone' },
  { id: 'tags',        label: 'Tag Colors' },
  { id: 'companies',   label: 'Companies',     module: 'career' },
  { id: 'keywords',    label: 'Keywords',      module: 'career' },
  { id: 'programs',    label: 'Programs',      module: 'career' },
  { id: 'bookmarklet', label: 'Bookmarklet' },
  { id: 'mobile',      label: 'iOS Shortcut' },
  { id: 'instagram',   label: 'Instagram',     module: 'reels' },
  { id: 'keybinds',    label: 'Keybinds' },
  { id: 'modules',     label: 'Modules' },
  { id: 'tokens',      label: 'Capture tokens' },
]

// One index entry per actual keybind, not one opaque entry for the whole tab —
// otherwise searching for a specific bind ("catch", "tidy", "snooze") matches
// nothing because none of those words live in a single generic blob. Handlers
// are never called here, so an empty ctx is safe.
const KEYBIND_ENTRIES = getCommands({}).map((cmd) => ({
  tab: 'keybinds',
  label: cmd.label,
  keywords: `${cmd.label} ${cmd.defaultKey ?? ''} ${cmd.category ?? ''} keybind hotkey shortcut keyboard bind remap`,
}))

export const SETTINGS_INDEX = [
  ...KEYBIND_ENTRIES,
  { tab: 'appearance', label: 'Color palette', keywords: 'theme dark light mode colour warm nord catppuccin tokyo rose pine appearance' },
  { tab: 'appearance', label: 'Interface style', keywords: 'style density neobrutalism minimal look feel appearance' },

  { tab: 'data',       label: 'GitHub backup', keywords: 'git sync backup repository repo export mirror restore token oauth data' },
  { tab: 'data',       label: 'Repository name', keywords: 'repo name private public backup github' },
  { tab: 'data',       label: 'Automatic backup', keywords: 'auto backup schedule github sync' },
  { tab: 'data',       label: 'Local backup (zip download)', keywords: 'zip download local backup export data offline file save copy no github' },
  { tab: 'data',       label: 'Import from zip', keywords: 'import zip restore backup upload file drop data recover recovery new account deleted account' },
  { tab: 'data',       label: 'Markdown export', keywords: 'export markdown md download zip readable claude project obsidian' },
  // Keywords come from the same FORMATS list MigrationView renders its format
  // picker from, so a new importer is searchable the moment it's added.
  {
    tab: 'data',
    label: 'Import from other apps',
    keywords: `import migration migrate bring in content bookmarks ${
      MIGRATION_FORMATS.map((f) => f.label).join(' ')
    }`,
  },

  { tab: 'twitter',    label: 'Twitter auth token', module: 'twitter', keywords: 'twitter x token cookie auth opportunity radar scraper' },

  { tab: 'shared',     label: 'Shared links', keywords: 'share public link unshare revoke published visibility' },

  { tab: 'behavior',   label: 'Archive confirmation toast', keywords: 'archive toast confirm undo notification behaviour' },
  { tab: 'behavior',   label: 'Trash confirmation toast', keywords: 'trash delete toast confirm undo notification behaviour' },
  { tab: 'behavior',   label: 'Ask-your-library assistant', keywords: 'ai assistant chat rag ask library enable disable' },
  { tab: 'behavior',   label: 'Usage this month', keywords: 'usage quota limit storage ai calls plan tier billing how much used remaining reset window meter' },

  { tab: 'timezone',   label: 'Timezone', keywords: 'timezone time zone clock utc gmt offset local browser default region city travel today overdue due date reminder agenda daylight saving dst' },

  { tab: 'tags',       label: 'Tag colors', keywords: 'tag colour color label highlight' },

  { tab: 'companies',  label: 'Companies watchlist', module: 'career', keywords: 'company watchlist career job employer track' },
  { tab: 'keywords',   label: 'Opportunity keywords', module: 'career', keywords: 'keyword radar filter job opportunity match alert' },
  { tab: 'programs',   label: 'Programs & fellowships', module: 'career', keywords: 'fellowship program internship scholarship deadline cohort apply' },

  { tab: 'bookmarklet',label: 'Bookmarklet', keywords: 'bookmarklet browser bookmark save page capture quick add desktop' },
  { tab: 'mobile',     label: 'iOS Shortcut', keywords: 'ios iphone shortcut share sheet mobile capture save' },
  { tab: 'mobile',     label: 'Recent captures', keywords: 'capture log history debug failed saved' },

  { tab: 'instagram',  label: 'Instagram Reels (parked)', module: 'reels', keywords: 'instagram reels video dm session cookie parked retired' },

  { tab: 'modules',    label: 'Modules on/off', keywords: 'module feature enable disable hide show turn off simplify declutter' },

  { tab: 'tokens',     label: 'Capture tokens', keywords: 'token capture revoke device secret bookmarklet shortcut security api' },
]

const norm = (s) => String(s ?? '').toLowerCase()

/**
 * Filters the index by query, respecting module visibility so a search never
 * surfaces a setting the user cannot open.
 */
export function searchSettings(query, isVisible = () => true) {
  const q = norm(query).trim()
  const available = SETTINGS_INDEX.filter((s) => !s.module || isVisible(s.module))
  if (!q) return []

  // All terms must match somewhere, so "tag color" narrows rather than widens.
  const terms = q.split(/\s+/)
  return available.filter((s) => {
    const hay = norm(s.label) + ' ' + norm(s.keywords) + ' ' + norm(s.tab)
    return terms.every((t) => hay.includes(t))
  })
}
