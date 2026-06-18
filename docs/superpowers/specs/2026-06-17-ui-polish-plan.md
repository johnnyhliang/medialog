# UI Polish Plan

**Date:** 2026-06-17
**When:** Before manual testing + the planned editor overhaul / new features
**Goal:** Turn a functionally-complete-but-piecemeal UI into something consistent and finished. The app works; it doesn't yet *feel* designed. Most issues are inconsistency from many separate build passes, not missing features.

---

## Known rough edges (grounded in the current code)

These are concrete, already-identifiable issues — the polish pass addresses them.

1. **Four different modal/overlay implementations** with inconsistent classes and z-indexes:
   - `.file-preview-overlay` (z 1000), `.embed-popover` (z 1100), `.modal-backdrop` / ConfirmModal (z 1200), `.history-modal` (z 1200), `.return-btn` (z 900).
   - No shared modal primitive → drift in padding, shadow, backdrop, close behavior, focus handling.

2. **Crowded entry-card action row** — pin ★, history 🕘, edit ✎, status `<select>`, delete 🗑 = 5 controls in one row. Cramped on mobile; emoji icons of varying weights.

3. **Two search boxes in browse** — the global `SearchBar` (cross-topic) and `TopicView`'s own scoped search both show when not querying. Redundant and confusing.

4. **Inconsistent icon language** — emoji used as icons (🗑 ✎ ★ 🕘 🔗 📄 🖼 💡 ↗ ✕). Mixed metaphors and weights; reads as unpolished next to the editorial typography.

5. **Master-doc / TopicView never visually reviewed** — Doc/List toggle, `.search-scope` select, the empty-doc prompt, embed chips, and the hover popover were built headlessly and never seen.

6. **Inconsistent empty states** — "No entries yet.", "No past versions yet.", "Trash is empty.", "Write a master doc…", "Nothing to preview yet." Different voice, weight, placement.

7. **No save/loading feedback** — note autosave is silent; GitHub backup status is raw text; import has no progress; no toast system.

8. **Typography scale not formalized** — font sizes (15/14/13.5/13/12.5/12/11.5/11/10.5px) are ad hoc across components.

9. **QuickAdd vs NoteEditor mismatch** — QuickAdd is a plain textarea; editing uses CodeMirror. (The planned editor overhaul unifies these — polish should set the foundation, not pre-build it.)

---

## Plan (phased, each independently shippable)

### Phase 0 — Visual audit (do first, ~30 min)
Run the app with the two pending migrations applied (`0007_master_doc`, `0008_entry_versions`). Walk every view (Browse/Doc + List, Sort, Revisit, Progress, Settings, Trash, Bulk, file preview, version history) on desktop **and** a narrow viewport. Capture a punch-list of what actually looks wrong (this plan is the hypothesis; the audit confirms/extends it). Output: a checked/annotated version of the "rough edges" list above.

### Phase 1 — Foundation & consistency (highest leverage)
- **Formalize design tokens** in `:root`: a typography scale (e.g. `--text-xs/sm/base/lg/xl`), spacing scale, shadow scale, z-index scale (`--z-modal`, `--z-popover`, `--z-toast`). Replace ad-hoc values.
- **One `Modal` primitive** (`src/components/Modal.jsx`): backdrop + centered panel + Esc/backdrop close + focus trap + consistent shadow/padding. Refactor ConfirmModal, FilePreviewModal, history modal to use it. Single z-index source.
- **Icon decision**: either standardize on one minimal SVG icon set (e.g. lucide) for the *controls* (pin/edit/delete/history) while keeping emoji only for content type tags, OR commit to emoji and normalize size/baseline. Pick one and apply everywhere.

### Phase 2 — Component polish
- **Entry card**: tidy the action row — group secondary actions into an overflow "⋯" menu on mobile; align the status select; consistent icon-button sizing/hover. Title/URL/Preview-button layout pass.
- **Browse search consolidation**: one search affordance. Recommended: drop the global `SearchBar`, fold cross-topic search into TopicView's scope selector ("Everything") by loading all entries when that scope is picked.
- **TopicView / master-doc**: style the Doc/List toggle as a proper segmented control; polish `.search-scope` (custom select), the empty-doc prompt, and embed-chip spacing. Verify hover-popover positioning on real layouts.
- **Sidebar**: topic list density, active states, and a hook for the future "top-level visual organization" roadmap item (grouping/pinned topics) — design the slot, don't build it.
- **Editor shell**: polish the write/preview/split toolbar, attach button, and tip into a coherent bar (sets up the planned bold/italic indicators + rich QuickAdd).

### Phase 3 — States & feedback
- Unified **empty-state** component (icon + line + optional action), one voice. Apply to all the scattered messages.
- **Autosave indicator** (subtle "Saved ·" / "Saving…") on note + master-doc edits.
- **Toast/inline feedback** for backup success/failure, import results, restore — replace raw status strings.

### Phase 4 — Responsive & final pass
- Mobile: sidebar collapse, modal full-screen behavior, card action overflow, editor split → stacked.
- Final consistency sweep: focus rings, hover transitions, contrast (status colors on off-white), tab order.

---

## Sequencing vs everything else

1. **Phase 0 audit** ← do during/before your manual testing (testing *is* the audit).
2. **Phase 1 + 2** ← the core polish; makes the app feel designed.
3. **Then** the **editor overhaul** (inline URL/title edit, rich QuickAdd, bold/italic indicators) — Phase 1's tokens + editor-shell polish are its foundation.
4. **Then** new roadmap features (archive, top-level visual organization, reader/highlights/SRS).

Phase 3/4 can interleave or follow.

---

## Decisions (locked)
- **Scope: Full pass (Phases 0–4).**
- **Icons: switch to an SVG set (`lucide-react`)** for controls (pin, edit, delete, history, close, prev/next, etc.). Keep emoji only for content-type tags in chips (📄 🖼 🎥 🔗 📝) where they read as content, not UI.

---

## Addendum — feedback from first testing (2026-06-17)

### UI (fold into Phase 2)
- **Buttons too close / don't look good** — the card action row needs real spacing, consistent sizing, and the new SVG icons (Phase 1). This is the top visual complaint.
- **Preview button has no file name** — it just says "Preview". It should show the file name: for a URL, the last path segment (`paper.pdf`); for an uploaded attachment, the stored filename. Derive via the same `fileName()` helper the modal uses.

### Attachments & image pipeline (FUNCTIONAL — pairs with the preview polish, not pure CSS)
- **Inline = compressed thumbnail, full image only on click.** Supabase's built-in resize/quality transforms (`getPublicUrl({ transform })`) are **Pro-plan only**, so we cannot rely on them on the free tier. Approach: **client-side compression at upload** — downscale with a `<canvas>` to a small thumbnail (e.g. ≤600px, WebP/JPEG q≈0.5) and upload **both** the thumbnail and the original. Inline note/card images render the thumbnail; clicking opens the FilePreviewModal with the original. Naming convention e.g. `…/<uuid>-name.ext` (original) + `…/<uuid>-name.thumb.webp` (thumbnail); the markdown image renderer shows the thumb and links the original.
- **Upload size cap → 25 MB.** Currently 10 MB in two places: `src/lib/storage.js` (`MAX_BYTES = 10*1024*1024`) and the bucket `file_size_limit` in `supabase/migrations/0004_attachments_storage.sql` (`10485760`). Raise both to `26214400` (25 MB). Reject larger files client-side (`isAllowedAttachment`) with a clear message; the bucket enforces server-side as defense-in-depth (needs a migration to alter the bucket limit).

### Backup of large files (decision recorded)
- GitHub backup stores **Markdown per entry only** — attachment **binaries are NOT backed up**, only their Supabase CDN URLs. **Decision: keep the two-tier model** (git = text/structure, Supabase = binaries); do not commit binaries to git (repo bloat, 100 MB GitHub limit, every version retained forever). Document this in Settings/Backup UI so the user knows attachments aren't in the git backup. A dedicated attachment-backup (e.g. to a second bucket or storage export) is a possible future item, not now.

---

## Non-goals
- No new features in the polish pass (editor overhaul, archive, etc. are separate).
- No framework/CSS-library migration (stay with the current hand-rolled CSS + tokens).
- No redesign of the visual identity (keep Lora + DM Sans + warm off-white).
- No Supabase Pro-plan dependency (image transforms must work on the free tier via client-side compression).
