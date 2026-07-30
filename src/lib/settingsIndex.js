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

export const SETTINGS_INDEX = [
  { tab: 'appearance', label: 'Color palette', keywords: 'theme dark light mode colour warm nord catppuccin tokyo rose pine appearance' },
  { tab: 'appearance', label: 'Interface style', keywords: 'style density neobrutalism minimal look feel appearance' },

  { tab: 'github',     label: 'GitHub backup', keywords: 'git sync backup repository repo export mirror restore token oauth' },
  { tab: 'github',     label: 'Repository name', keywords: 'repo name private public backup github' },
  { tab: 'github',     label: 'Automatic backup', keywords: 'auto backup schedule github sync' },

  { tab: 'twitter',    label: 'Twitter auth token', module: 'twitter', keywords: 'twitter x token cookie auth opportunity radar scraper' },

  { tab: 'shared',     label: 'Shared links', keywords: 'share public link unshare revoke published visibility' },

  { tab: 'behavior',   label: 'Archive confirmation toast', keywords: 'archive toast confirm undo notification behaviour' },
  { tab: 'behavior',   label: 'Trash confirmation toast', keywords: 'trash delete toast confirm undo notification behaviour' },
  { tab: 'behavior',   label: 'Ask-your-library assistant', keywords: 'ai assistant chat rag ask library enable disable' },

  { tab: 'tags',       label: 'Tag colors', keywords: 'tag colour color label highlight' },

  { tab: 'companies',  label: 'Companies watchlist', module: 'career', keywords: 'company watchlist career job employer track' },
  { tab: 'keywords',   label: 'Opportunity keywords', module: 'career', keywords: 'keyword radar filter job opportunity match alert' },
  { tab: 'programs',   label: 'Programs & fellowships', module: 'career', keywords: 'fellowship program internship scholarship deadline cohort apply' },

  { tab: 'bookmarklet',label: 'Bookmarklet', keywords: 'bookmarklet browser bookmark save page capture quick add desktop' },
  { tab: 'mobile',     label: 'iOS Shortcut', keywords: 'ios iphone shortcut share sheet mobile capture save' },
  { tab: 'mobile',     label: 'Recent captures', keywords: 'capture log history debug failed saved' },

  { tab: 'instagram',  label: 'Instagram Reels (parked)', module: 'reels', keywords: 'instagram reels video dm session cookie parked retired' },

  { tab: 'keybinds',   label: 'Keyboard shortcuts', keywords: 'keybind hotkey shortcut keyboard bind remap' },

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
