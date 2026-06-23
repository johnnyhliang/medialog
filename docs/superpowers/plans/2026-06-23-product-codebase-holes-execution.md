# Product and Codebase Holes Execution Plan

Date: 2026-06-23

## Intent

Execute only the concrete product holes and codebase holes identified in the product audit. This plan intentionally excludes speculative or "next-level" feature ideas such as related entries, topic distillation, reader mode, application CRM expansion, backlink graph, or new AI workflows.

## Target Holes

This plan covers only:

- Visible mojibake / corrupted UI text.
- Missing coherent daily loop on Home.
- Silent failures and weak operation feedback.
- Missing save/enrich/embed pipeline visibility.
- Personal capture endpoint polish gaps.
- Passive Digest that reports issues but does not guide action.
- Shallow Applications reliability/UX gaps only where they overlap with feedback/error handling.
- Bloat and unnecessary defensive programming discovered while fixing the above holes.

## Non-Goals

Do not implement in this execution pass:

- Related entries.
- Topic distillation.
- Reader mode.
- New AI features.
- Application CRM redesign.
- Timeline/event-log system.
- New dependencies.
- Large state-management rewrite.
- Multi-user capture architecture.
- Major UI redesign outside affected surfaces.
- Broad cleanup of unrelated files.
- Refactors that only move code without reducing risk, duplication, or complexity.

## Execution Principles

- Keep diffs small and reviewable.
- Preserve existing behavior unless explicitly improving error visibility.
- Prefer existing hooks, toasts, and DB helpers.
- Do not block capture/save because optional enrichment failed.
- Add tests for changed behavior.
- Run build and tests after each implementation phase.
- Delete or simplify code when the safer path is smaller.
- Remove unnecessary defensive programming only when behavior is already protected or can be covered by a small regression test.

## Cleanup Rules

Cleanup is allowed only when it directly supports the target holes. It should be done as part of the relevant phase, not as a separate wandering pass.

### Allowed Cleanup

- Remove unused imports, variables, branches, and state created by touched code.
- Replace repeated `try/catch {}` blocks with a shared small helper when the fallback behavior is identical.
- Remove defensive checks that mask real failures after adding visible error handling.
- Collapse duplicate loading/error state patterns in the same component.
- Delete comments that explain obsolete workarounds.
- Replace inline style or inline handler duplication when it materially simplifies touched components.
- Remove redundant local state if the same value is already available from props or derived data.
- Replace `alert()` and `confirm()` only where the touched flow already has a modal/toast pattern available.

### Disallowed Cleanup

- Rewriting app-level state management.
- Reorganizing directories.
- Creating new abstraction layers for hypothetical future use.
- Touching imported user content.
- Reformatting entire files only because they were touched.
- Replacing all defensive code globally.
- Changing DB schema only to make cleanup prettier.

### Defensive Programming Standard

Keep defensive code when:

- It protects against untrusted input.
- It handles browser APIs that can genuinely fail, such as `localStorage`.
- It protects optional external services such as feeds, AI, backups, and embeddings.
- It prevents destructive data loss.

Remove or simplify defensive code when:

- It silently hides a mutation failure the user should know about.
- It catches errors and does nothing even though the UI can show a toast.
- It duplicates identical fallback logic in the same file.
- It guards impossible states already enforced by component props, DB constraints, or previous validation.
- It makes tests harder while not changing user-visible behavior.

### Cleanup Acceptance Criteria

- Net code complexity decreases in touched areas.
- Any removed defensive branch is either covered by an existing invariant or replaced with visible error handling.
- No user-facing behavior changes except clearer error reporting and simpler UI text.
- Tests/build still pass.

## Phase 0: Baseline Verification

### Goal

Establish current app health before edits.

### Tasks

- Run unit tests.
- Run build.
- Run lint if it is currently usable.
- Record existing failures separately from new failures.

### Commands

- `npm test`
- `npm run build`
- `npm run lint`

### Acceptance Criteria

- Known baseline is documented in the final implementation report.
- No code changes happen before understanding current verification status.

## Phase 1: Runtime Mojibake Cleanup

### Goal

Remove visibly corrupted text from runtime UI source.

### Files To Inspect

- `src/App.jsx`
- `src/components/QuickAdd.jsx`
- `src/components/ExploreView.jsx`
- `src/components/EntryCard.jsx`
- `src/components/NoteEditor.jsx`
- `src/components/FeedView.jsx`
- `src/components/ApplicationsView.jsx`
- `src/components/settings/KeybindsTab.jsx`
- `src/styles.css`

### Tasks

- Search runtime source for common mojibake sequences:
  - `â`
  - `Â`
  - `Ã`
  - `ð`
- Replace corrupted glyphs with ASCII-safe text unless a Unicode symbol is clearly intentional and verified.
- Prefer:
  - `...` instead of ellipsis mojibake.
  - `->` instead of arrow mojibake.
  - `x` instead of corrupted close symbols.
  - `-` or `.` instead of corrupted bullets.
  - `Loading...`, `Save failed`, `Pick topic`, `No notes yet - why does this matter?`.
- Do not modify imported user notes under `import/`.
- Do not modify previous spec/plan docs as part of this cleanup.
- Remove now-obsolete comments that refer to corrupted glyphs or old visual hacks if encountered in touched blocks.
- Remove unused imports in files touched for string cleanup.

### Tests

- Existing component tests that render touched components.
- Build.

### Acceptance Criteria

- No mojibake sequences remain in `src/`.
- App labels remain readable.
- Tests/build pass or failures are documented as pre-existing.

## Phase 2: Consistent Async Error Feedback

### Goal

Make important failed operations visible without adding noisy alerts.

### Files To Inspect

- `src/App.jsx`
- `src/hooks/useToast.js`
- `src/components/Toast.jsx`
- `src/components/EntryCard.jsx`
- `src/components/FeedView.jsx`
- `src/components/ApplicationsView.jsx`

### Tasks

- Add a small helper pattern for async action failures if one does not already exist.
- Wrap high-value mutations in user-visible failure handling:
  - quick add entry
  - delete entry
  - status change
  - note save
  - title/url update
  - move entry
  - feed save/dismiss
  - application status/note/delete changes
- Replace `alert()` usage for GitHub callback failure with toast where practical.
- Keep optimistic updates only where rollback or refetch is safe.
- Where rollback is not easy, show a failure toast and trigger a refresh of the affected list.
- Remove silent `catch {}` blocks in touched mutation paths after replacing them with visible handling.
- Consolidate repeated toast/error messages where doing so reduces duplication without adding a large abstraction.

### Tests

- Add targeted tests for at least one failed mutation path.
- Existing tests for touched components/hooks.

### Acceptance Criteria

- Failed saves/deletes/status changes are visible to the user.
- App does not silently pretend a failed mutation succeeded.
- No optional enrichment failure prevents the core saved entry from remaining usable.

## Phase 3: Note Autosave Failure State

### Goal

Make entry note autosave trustworthy.

### Files To Inspect

- `src/components/EntryCard.jsx`
- `src/components/NoteEditor.jsx`
- `src/components/EntryCard.test.jsx`

### Tasks

- Add an explicit `failed` save status in `EntryCard`.
- On autosave failure, show `Save failed` near the editor controls.
- Add a retry button or make the next edit retry automatically while keeping the failed state visible until success.
- Ensure `Done` does not silently close editing if final save fails.
- Keep version snapshot creation only after a successful final save.
- Simplify `saveStatus` transitions if the added `failed` state makes existing timer/reset logic redundant.
- Avoid extra defensive state if the editor can derive display from one status enum.

### Tests

- Test autosave failure displays failure state.
- Test successful save clears failure state.
- Test `Done` behavior does not hide a failed final save.

### Acceptance Criteria

- Users can tell when note changes did not save.
- Failed note edits are not silently discarded.
- Existing successful autosave behavior remains unchanged.

## Phase 4: Entry Creation Pipeline Visibility

### Goal

Expose the difference between required save and optional enrichment/indexing.

### Files To Inspect

- `src/App.jsx`
- `src/components/QuickAdd.jsx`
- `src/components/Toast.jsx`
- `src/lib/enrich.js`
- `src/lib/embedEntry.js`

### Tasks

- Add transient status feedback after QuickAdd submit:
  - saving
  - saved
  - fetching title
  - indexing
  - complete
  - optional failure
- Keep the core entry save as the only required success condition.
- If title fetch fails, show quiet warning: entry saved, title not fetched.
- If embedding fails, show quiet warning: entry saved, search indexing pending/failed.
- Avoid durable DB schema changes in this phase unless absolutely necessary.
- Keep pipeline state transient and minimal. Do not add a general job system.
- Remove duplicate enrichment failure handling if QuickAdd/App-level handling now covers it.

### Tests

- Test QuickAdd clears inputs only after core save succeeds.
- Test failed core save preserves draft input.
- Test optional enrichment failure does not remove the saved entry.

### Acceptance Criteria

- User sees save succeeded even if enrichment fails.
- User sees core save failure and can retry.
- QuickAdd does not lose unsaved input on failed core save.

## Phase 5: Home Daily Loop From Existing Data

### Goal

Add a coherent "what should I do next?" surface without building new major features.

### Files To Inspect

- `src/components/HomeView.jsx`
- `src/components/WidgetPanel.jsx`
- `src/components/DigestView.jsx`
- `src/lib/db/digest.js`
- `src/App.jsx`

### Tasks

- Reuse or extend existing digest queries to compute a home review summary.
- Add a top Home section above the current widgets/topics with:
  - inbox count
  - old inbox count
  - stale backlog count
  - active reading queue count
  - dormant topic count
  - recommended next action
- Wire actions to existing views:
  - Sort Inbox
  - Digest
  - Revisit
  - Explore
- Do not add new workflows yet; use navigation and counts only.
- Prefer deriving counts from one helper over duplicating digest queries in multiple components.
- Keep `HomeView` presentational if possible; put query/derivation logic in a helper or parent only when that reduces component bloat.

### Tests

- Add or update `HomeView` tests for summary rendering.
- Add helper tests for review summary calculation if a new helper is created.

### Acceptance Criteria

- Home clearly suggests the next maintenance action.
- Existing widgets remain accessible.
- No new backend schema is required.

## Phase 6: Digest Actionability, Minimal Pass

### Goal

Make Digest more than a report while staying within existing behaviors.

### Files To Inspect

- `src/components/DigestView.jsx`
- `src/lib/db/digest.js`
- `src/App.jsx`

### Tasks

- Add actions to digest list items where handlers already exist:
  - open entry
  - go to topic/entry where possible
  - mark done where entry id is available
  - snooze if existing snooze UI can be reused safely
- Prefer navigation and existing handlers over new complex in-place editing.
- Add "Start with Sort Inbox" CTA when old inbox items exist.
- Add "Review active queue" CTA when active reading queue exists.
- Remove duplicated item label/date formatting if Home review summary and Digest need the same formatting.

### Tests

- Component test for CTA rendering.
- Component test for calling open-entry handler.

### Acceptance Criteria

- User can act on Digest findings without manually hunting through the app.
- No new permanent workflow state is introduced.

## Phase 7: Capture Endpoint Polish, Minimal Pass

### Goal

Improve feedback and correctness for current personal capture without redesigning auth.

### Files To Inspect

- `supabase/functions/capture/index.ts`
- `src/components/SettingsView.jsx`

### Tasks

- Ensure capture inserts enough title/note data to avoid blank-looking inbox entries when possible.
- Return useful JSON response fields:
  - `ok`
  - `entry_id`
  - `duplicate` if duplicate detection is added in-function
  - `message`
- Improve bookmarklet feedback text in Settings.
- Keep `CAPTURE_SECRET` and `CAPTURE_USER_ID` for now.
- Keep SSRF and auth defensive checks. These are security controls, not cleanup targets.
- Simplify repeated JSON response construction only if it makes error responses more consistent.

### Tests

- Add function-level tests if existing edge-function test pattern exists.
- Otherwise document manual verification steps.

### Acceptance Criteria

- Bookmarklet/capture response is more informative.
- Capture failures return clear reasons.
- Current personal deployment contract remains compatible.

## Phase 8: Final Verification and Cleanup

### Goal

Ensure the hole-fix pass is complete and bounded.

### Tasks

- Run full tests.
- Run build.
- Run lint.
- Search for remaining mojibake in `src/`.
- Review changed files for scope creep.
- Document known remaining risks.

### Commands

- `npm test`
- `npm run build`
- `npm run lint`
- `rg -n "â|Â|Ã|ð" src`

### Acceptance Criteria

- No runtime mojibake remains in `src/`.
- Core mutation failures are visible.
- Note autosave failure is visible.
- QuickAdd preserves unsaved data on core save failure.
- Home includes a clear next-action review summary.
- Digest includes minimal action/navigation affordances.
- No speculative feature work has been included.

## Suggested Execution Order

1. Baseline verification.
2. Mojibake cleanup.
3. Note autosave failure state.
4. QuickAdd save/enrich/embed feedback.
5. Broader async mutation error toasts.
6. Home daily-loop summary.
7. Minimal Digest actionability.
8. Capture endpoint response polish.
9. Final verification.

## Reporting Requirements

Final implementation report should include:

- Changed files.
- Holes addressed.
- Tests run and results.
- Existing failures, if any.
- Remaining holes intentionally not addressed.
- Confirmation that speculative feature ideas were not implemented.
