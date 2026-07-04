export function getCommands(ctx) {
  // ctx: { setView, setSelectedId, inboxTopic, topics, focusedEntry,
  //        openPalette, closePalette, openSnooze }
  return [
    // App
    {
      id: 'app.palette',
      label: 'Open command palette',
      category: 'App',
      defaultKey: 'ctrl+k',
      handler: () => ctx.openPalette?.(),
    },
    {
      id: 'app.catch',
      label: 'Catch a thought (quick save to Inbox)',
      category: 'App',
      defaultKey: 'c',
      handler: () => ctx.openCatch?.(),
    },
    // Navigation
    {
      id: 'nav.tidy',
      label: 'Go to Tidy queue',
      category: 'Navigation',
      defaultKey: 'g y',
      handler: () => ctx.setView?.('tidy'),
    },
    {
      id: 'nav.home',
      label: 'Go to Home',
      category: 'Navigation',
      defaultKey: 'g h',
      handler: () => ctx.setView?.('home'),
    },
    {
      id: 'nav.inbox',
      label: 'Go to Inbox',
      category: 'Navigation',
      defaultKey: 'g i',
      handler: () => {
        if (ctx.inboxTopic) { ctx.setSelectedId?.(ctx.inboxTopic.id); ctx.setView?.('browse') }
      },
    },
    {
      id: 'nav.explore',
      label: 'Go to Explore',
      category: 'Navigation',
      defaultKey: 'g e',
      handler: () => ctx.setView?.('explore'),
    },
    {
      id: 'nav.trash',
      label: 'Go to Trash',
      category: 'Navigation',
      defaultKey: 'g t',
      handler: () => ctx.setView?.('trash'),
    },
    // Entry
    {
      id: 'entry.next',
      label: 'Focus next entry',
      category: 'Entry',
      defaultKey: 'j',
      handler: () => ctx.focusNextEntry?.(),
    },
    {
      id: 'entry.prev',
      label: 'Focus previous entry',
      category: 'Entry',
      defaultKey: 'k',
      handler: () => ctx.focusPrevEntry?.(),
    },
    {
      id: 'entry.edit',
      label: 'Edit focused entry',
      category: 'Entry',
      defaultKey: 'e',
      handler: () => ctx.editFocusedEntry?.(),
    },
    {
      id: 'entry.cycleStatus',
      label: 'Cycle focused entry status',
      category: 'Entry',
      defaultKey: 'x',
      handler: () => ctx.cycleFocusedStatus?.(),
    },
    {
      id: 'entry.openUrl',
      label: 'Open focused entry URL',
      category: 'Entry',
      defaultKey: 'o',
      handler: () => {
        if (ctx.focusedEntry?.url) window.open(ctx.focusedEntry.url, '_blank', 'noopener')
      },
    },
    {
      id: 'entry.snooze',
      label: 'Snooze focused entry',
      category: 'Entry',
      defaultKey: '',
      handler: () => ctx.openSnooze?.(ctx.focusedEntry),
    },
  ]
}
