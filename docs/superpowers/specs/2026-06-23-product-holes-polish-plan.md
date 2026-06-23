# MediaLog Product Holes and Polish Implementation Plan

Date: 2026-06-23

## Scope

This document captures a codebase-grounded product audit and implementation plan for polishing MediaLog into a more coherent daily-use app.

The audit was intentionally based on runtime code, feature components, Supabase functions, and data helpers rather than prior spec or plan files.

## Current Product Shape

MediaLog is already more than a bookmark manager. The codebase contains:

- Link and note capture through topic entries.
- Inbox sorting, topic browsing, archive, trash, revisit, and progress views.
- Topic master docs with embedded entry references.
- Markdown editing with attachments, previews, version history, and checkboxes.
- Semantic search, title enrichment, duplicate detection, and AI helper functions.
- Feed reader, market/opportunity widgets, weather/search widgets, and focus widgets.
- Applications tracker for job/opportunity workflow.
- GitHub backup and import/export flows.
- Supabase edge functions for capture, enrichment, AI, embedding, reels, opportunities, and backups.
- MCP server integration for external read/write automation.

The raw ingredients are strong. The primary weakness is not lack of features; it is that the app does not yet present a tight daily workflow, visible reliability state, or enough trust signals for a personal memory system.

## Big Holes

### 1. Mojibake and Encoding Corruption

Several UI strings appear corrupted in source as mojibake, for example `â€¦`, `Â·`, `Ã—`, `â†’`, and related sequences. This is highly visible and makes the app feel broken even when behavior is correct.

Known affected areas include:

- Quick add and note editor microcopy.
- Explore and feed punctuation/icons.
- Entry card status/action labels.
- Sidebar toggle glyphs.
- Application tracker action labels.

Impact:

- Immediate perceived quality drop.
- Possible confusion around controls.
- Harder to distinguish intentional glyphs from broken UI.

Implementation direction:

- Replace mojibake sequences with ASCII-safe text where possible.
- Use plain labels such as `...`, `x`, `->`, `Pick topic`, and `Loading...`.
- Only preserve Unicode where it is intentional and verified in UTF-8.

### 2. Missing Coherent Daily Loop

The app has many valuable surfaces, but they are spread across many tabs:

- Home
- Explore
- Bulk Import
- Archive
- Sort Inbox
- Revisit
- Progress
- Settings
- Trash
- Files
- Feed
- Applications
- Digest

Users must already know what to do next. The app needs a guided operating loop.

Implementation direction:

- Turn the home/dashboard into a daily command center.
- Promote a prioritized queue: sort inbox, review stale backlog, revisit old entries, process active reading, check backup/index health.
- Keep secondary features accessible, but make the default path obvious.

Inspired by:

- Superhuman inbox zero.
- Things Today view.
- Readwise Reader daily review.
- Linear issue health cues.

### 3. Silent Failures and Weak Trust Signals

Several important operations fail silently or optimistically update UI with limited recovery:

- Auto-backup failures are silent.
- Feed refresh failures are swallowed.
- Entry autosave failures reset to idle.
- AI/embedding failures are best-effort but not surfaced.
- Some local storage and network operations are ignored.

This is dangerous for a memory app. The user needs to know whether content is saved, indexed, backed up, and recoverable.

Implementation direction:

- Add a lightweight operation status layer.
- Surface retryable failures through toasts or a status panel.
- Add visible states for save, embed, backup, and sync.
- Prefer non-blocking warnings over modal interruptions.

### 4. No Save/Sync/Index Pipeline Visibility

Entry creation runs a multi-step pipeline:

- Create row.
- Set tags.
- Fetch title.
- Update title.
- Generate embedding.
- Possibly backup later.

The app currently behaves as if this is one action. That hides failures and makes the system feel less intelligent.

Implementation direction:

- Add per-entry metadata/status indicators for:
  - Saved.
  - Title enriched.
  - Embedded/indexed.
  - Backed up.
  - Failed with retry.
- Start with local transient UI state before adding durable DB columns.

### 5. Capture Endpoint Is Personal But Not Product-Grade

The capture function uses `CAPTURE_SECRET` and `CAPTURE_USER_ID`, which is acceptable for a personal deployment but limits multi-user polish and user confidence.

Implementation direction:

- Preserve current personal capture path.
- Add a future authenticated capture path tied to the current user/session.
- Improve bookmarklet feedback and duplicate handling.
- Show captured source/device metadata if available.

### 6. Applications Tracker Is Useful But Shallow

The Applications view supports statuses, notes, URLs, applied dates, deadlines, and prefill from opportunities. It lacks the CRM features that make this workflow sticky.

Implementation direction:

- Add next follow-up date.
- Add contact/person fields.
- Add timeline events.
- Add follow-up reminders.
- Add email snippets and interview notes.
- Add company research links connected to existing entries.

Inspired by:

- Huntr.
- Clay.
- Airtable lightweight CRM.
- Linear-style status movement.

### 7. Digest Is Passive

Digest identifies stale backlog, old inbox items, dormant topics, and active queue items. It does not turn those findings into a review session.

Implementation direction:

- Convert digest sections into actionable cards.
- Add actions directly in digest:
  - Sort.
  - Snooze.
  - Mark done.
  - Add takeaway.
  - Move topic.
  - Archive.
- Add a "Start review" button that walks through the items one by one.

## Product Ideas Worth Stealing

### Daily Review Command Center

Create a home module that shows:

- Inbox items to triage.
- Stale backlog items.
- Active reading queue.
- Revisit candidates.
- Unnoted old saves.
- Backup/index health.
- One recommended next action.

This makes MediaLog feel like an assistant instead of a database.

### Inbox Zero Triage

Make Sort Inbox keyboard-first:

- `j/k`: move selection.
- `a`: archive/done.
- `s`: snooze.
- `m`: move topic.
- `d`: delete.
- `n`: add note.
- `t`: tag.

Each item should support quick decisions without opening full card editing.

### Memory Health Score

Add a simple health panel:

- Oldest inbox item.
- Count of entries without notes.
- Count of stale active/backlog items.
- Count of entries missing embeddings.
- Last successful backup.
- Failed operations needing retry.

This creates a dashboard reason to return.

### Reader Mode

For saved URLs:

- Favicon/domain.
- Title.
- Summary.
- Estimated read time.
- Thumbnail where available.
- Read status.
- Takeaway prompt when marking done.

The current entry cards already have title, favicon, YouTube thumbnails, notes, and status, so this is an incremental evolution.

### Related Entries

Use existing embeddings to show:

- Similar saved items.
- Possible duplicates.
- Related topic suggestions.
- "You saved something like this before."

This is likely one of the highest-leverage AI features because it builds on existing semantic search.

### Topic Distillation

For a topic, generate:

- What this topic is about.
- Important saved links.
- Key takeaways.
- Open loops.
- Suggested doc outline.
- Dormant or unresolved items.

This fits the existing master-doc model better than adding generic chat.

### Job/Application CRM Upgrade

Expand Applications into a focused opportunity CRM:

- Pipeline columns.
- Follow-up queue.
- Contact log.
- Notes by interaction.
- Company research entries.
- Email draft snippets.
- Deadline warnings.

This complements the existing opportunity radar.

### Unified Activity Timeline

Log important events:

- Entry captured.
- Topic moved.
- Status changed.
- Tags changed.
- Note version saved.
- Snoozed.
- Unsnoozed.
- Archived.
- Restored.
- Backed up.
- Embedded.

Use it for debugging, review, and user confidence.

## Implementation Plan

### Phase 0: Safety and Baseline

Goal:

- Establish reliable verification before polish changes.

Tasks:

- Run existing tests.
- Run build.
- Identify currently failing tests separately from new regressions.
- Add or update regression tests around any touched behavior.

Verification:

- `npm test`
- `npm run build`
- Targeted component tests where behavior changes.

### Phase 1: Encoding Cleanup

Goal:

- Remove visible mojibake from runtime UI.

Tasks:

- Search source for common mojibake sequences.
- Replace corrupted punctuation/glyphs with ASCII-safe strings unless a file already intentionally uses verified UTF-8.
- Prioritize `src/` and user-visible Supabase-generated strings.
- Avoid altering imported notes/content unless explicitly requested.

Likely files:

- `src/App.jsx`
- `src/components/QuickAdd.jsx`
- `src/components/ExploreView.jsx`
- `src/components/EntryCard.jsx`
- `src/components/NoteEditor.jsx`
- `src/components/FeedView.jsx`
- `src/components/ApplicationsView.jsx`
- `src/components/settings/KeybindsTab.jsx`
- `src/styles.css`

Acceptance criteria:

- No obvious `â`, `Â`, `Ã` mojibake sequences remain in runtime source.
- UI labels remain understandable.
- Tests and build pass.

### Phase 2: Operation Feedback Layer

Goal:

- Make save/sync failures visible without making the app noisy.

Tasks:

- Create a small operation helper or hook for async UI actions.
- Add consistent error toasts for failed entry mutations.
- Change autosave failure from silent idle reset to visible "Save failed" state with retry.
- Surface feed refresh failures as non-blocking warnings.
- Surface auto-backup failure in a quiet status location instead of fully silent failure.

Acceptance criteria:

- User can tell when a save failed.
- User can retry important failed operations.
- Successful paths remain low-friction.
- No broad refactor of all data access in one pass.

### Phase 3: Save/Enrich/Embed Pipeline Visibility

Goal:

- Make entry creation feel reliable and intelligent.

Tasks:

- Track transient pipeline state after quick add:
  - saving
  - saved
  - fetching title
  - embedding
  - complete
  - failed
- Show compact status in toast or newly inserted card.
- Add retry for failed title fetch and embedding where practical.
- Consider durable columns later only if transient state is not enough.

Acceptance criteria:

- Adding a URL visibly progresses through title/enrichment/indexing.
- Failed enrichment does not imply failed save.
- Entry remains usable even if optional steps fail.

### Phase 4: Daily Review Command Center

Goal:

- Replace scattered "what now?" behavior with one recommended workflow.

Tasks:

- Extend existing digest data helper or add a home review helper.
- Show a home card with:
  - inbox count and oldest inbox age
  - stale backlog count
  - active reading queue
  - revisit candidates
  - entries without notes
  - backup/index status if available
- Add primary CTA: `Start Review`.
- Start with navigation actions before building a full guided modal.

Acceptance criteria:

- Home tells the user the most useful next action.
- Existing widgets remain but do not bury the review workflow.
- Digest logic is reused where reasonable.

### Phase 5: Actionable Digest

Goal:

- Turn passive reports into decisions.

Tasks:

- Add action buttons to digest entries:
  - open entry
  - mark done
  - snooze
  - move
  - delete
- Add a compact review session that steps through items.
- Reuse existing handlers from `App.jsx` where possible.

Acceptance criteria:

- A user can clear stale digest items without leaving the workflow.
- Digest becomes a maintenance tool, not just a report.

### Phase 6: Inbox Zero Triage Upgrade

Goal:

- Make inbox processing fast and satisfying.

Tasks:

- Improve `SortInbox` as a focused triage mode.
- Add keyboard shortcuts for move, delete, snooze, note, and done.
- Add visible current selection.
- Add progress count.
- Add quick note/takeaway field.

Acceptance criteria:

- User can process inbox without mouse-heavy navigation.
- Decisions are reversible where destructive.
- Existing sorting behavior remains intact.

### Phase 7: Related Entries

Goal:

- Make semantic search useful in context.

Tasks:

- Add a related entries query using existing embedding RPC.
- Display similar entries in expanded entry cards or topic doc sidebar.
- Hide weak matches.
- Add "possible duplicate" treatment for high-similarity items.

Acceptance criteria:

- Related entries appear only when useful.
- No major performance hit on topic browse.
- Feature degrades gracefully if embeddings are unavailable.

### Phase 8: Applications CRM Upgrade

Goal:

- Make opportunity tracking a complete loop.

Tasks:

- Add DB migration for follow-up/contact/timeline fields.
- Add next follow-up date.
- Add contacts.
- Add interaction notes.
- Add follow-up queue.
- Add deadline/follow-up alerts to Home.

Acceptance criteria:

- Applications view answers "who should I follow up with today?"
- Opportunity radar can feed into the tracker.
- Existing app statuses and notes migrate safely.

## Risk Management

### Avoid Big-Bang Refactors

The app is currently broad but functional. Do not centralize all state or rewrite all data access as part of polish. Improve one reliability path at a time.

### Preserve Personal-App Speed

Do not make every optional failure blocking. Enrichment, embeddings, feeds, and backup should fail visibly but not stop capture.

### Keep New Dependencies Out

No new dependencies are needed for the first six phases.

### Favor Reuse

Reuse:

- Existing toast system.
- Existing digest queries.
- Existing command palette/keybinding infrastructure.
- Existing entry handlers.
- Existing semantic embedding RPC.

## Recommended First PR

Title:

- Fix visible UI corruption and add save failure feedback

Scope:

- Replace mojibake in runtime UI source.
- Add visible autosave failure state in entry editor.
- Add error toast around quick add save failure.
- Add tests only where behavior changes.

Why first:

- It removes the most visible polish problem.
- It improves trust immediately.
- It is small and reversible.

## Recommended Second PR

Title:

- Add daily review summary to Home

Scope:

- Reuse digest/helper queries.
- Add a top-priority review card above widgets.
- Link to sort inbox, revisit, and digest.
- Show counts and one recommended next action.

Why second:

- It turns existing features into a coherent workflow without heavy backend changes.

## Recommended Third PR

Title:

- Make Digest actionable

Scope:

- Add entry actions to digest items.
- Add open-entry wiring.
- Add lightweight review session or batch action buttons.

Why third:

- It transforms passive insight into behavior change.

