Delta

┌─────────────────────────────────┬──────────────┬──────────────┬──────────────────────┐
│                                 │    Before    │    After     │                      │
├─────────────────────────────────┼──────────────┼──────────────┼──────────────────────┤
│ app-*.js                        │ 1,142 KB     │ 411 KB       │ −64%                 │
├─────────────────────────────────┼──────────────┼──────────────┼──────────────────────┤
│ v8.evaluateModule (4× throttle) │ 582 ms       │ 139 ms       │ −76%                 │
├─────────────────────────────────┼──────────────┼──────────────┼──────────────────────┤
│ FCP, cold, authenticated        │ ~1,660 ms    │ ~1,050 ms    │ −37%                 │
├─────────────────────────────────┼──────────────┼──────────────┼──────────────────────┤
│ Data settled                    │ 2,400 ms     │ 1,840 ms     │ −23%                 │
├─────────────────────────────────┼──────────────┼──────────────┼──────────────────────┤
│ Open 400-entry topic            │ 734 ms       │ 494 ms       │ −33%                 │
├─────────────────────────────────┼──────────────┼──────────────┼──────────────────────┤
│ Mount round trips               │ 22 / 3 waves │ 22 / 3 waves │ unchanged, untouched │
└─────────────────────────────────┴──────────────┴──────────────┴──────────────────────┘

Before-side spread across runs was 1,516–1,972 ms FCP; after-side 992–1,068 ms. The gap is well outside the noise.

I under-predicted this one. I said the bundle would land at ~620 KB and eval at ~330 ms; it came in at 411 KB and 139 ms. The reason is that CodeMirror was anchoring more than itself — the lezer grammars and part of the markdown tail were only in the entry chunk because CodeMirror was, so they left with it.

The honest caveat: I made both changes before re-measuring, so I can't separate jszip's contribution from CodeMirror's. jszip is now its own 97 KB chunk that loads only on Obsidian import; CodeMirror is a 657 KB NoteEditor chunk that loads when you open an editor.

The data path is unchanged by design — 22 round trips in 3 waves, exactly as before. It settles earlier only because the shell stops blocking it.

Two files changed

- src/lib/parseMigration.js — static import JSZip → await import('jszip') inside the already-async parseObsidianZip
- src/components/TopicView.jsx — TopicDocEditor behind lazy() + Suspense, matching the fallback EntryCard.jsx:357 already uses

Verified: npx vitest run → 748 passed / 117 files. npx vite build → clean.

What the profile now says is next

Layout is the largest remaining pre-FCP block: 400 ms at 4× throttle, essentially unmoved by this pass (466 → 400 ms). It is now a bigger single cost than all JavaScript evaluation combined. That is the first evidence I've seen that could implicate styles.css — 129 KB applied to a large DOM — but I haven't measured it yet, and I'd want to before touching a file you've ranked as maintainability rather than speed.

Also worth a look later: the NoteEditor chunk is 657 KB and trips Vite's warning on its own. It's off the critical path now, but it's what you wait for when you click into an editor.