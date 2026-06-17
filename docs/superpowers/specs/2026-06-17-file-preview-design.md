# File Preview & Smart Editor — Design Spec

**Date:** 2026-06-17
**Status:** Approved
**Branch:** feat/ai-infra

---

## Overview

Unified file preview system for MediaLog. Any file URL — uploaded to Supabase Storage, a direct `.pdf`/`.jpg`/`.txt` link, or a Google Drive share — opens in a consistent lazy-loaded modal. Smart punctuation pairs (`*`, `**`, `_`, `[`) are added to the CodeMirror note editor.

---

## 1. URL Classifier

**File:** `src/lib/classifyUrl.js`

```
classifyUrl(url: string) → 'pdf' | 'image' | 'text' | 'drive' | null
```

Detection rules (priority order):

1. **drive** — hostname is `drive.google.com` or `docs.google.com`
2. **pdf** — URL path ends in `.pdf` (case-insensitive)
3. **image** — URL path ends in `.jpg`, `.jpeg`, `.png`, `.gif`, `.webp`, `.svg`
4. **text** — URL path ends in `.txt`, `.md`, `.csv`
5. **storage** — matches Supabase project URL + `/storage/v1/object/` → classified by extension using rules 2–4
6. Everything else → `null`

Supabase Storage URLs classify by extension (a stored PDF is `'pdf'`, a stored image is `'image'`).

The existing `isPdfUrl()` in `LinkEmbed.jsx` is replaced by `classifyUrl(url) === 'pdf'`.

---

## 2. FilePreviewModal

**File:** `src/components/FilePreviewModal.jsx` (React.lazy'd at call sites)

### Layout

```
┌─────────────────────────────────────────────────────┐
│ 📄 paper.pdf              [Open ↗]      [✕ Close]  │
├──────────────┬──────────────────────────────────────┤
│              │                                      │
│  ToC         │   Content area                       │
│  (PDF only)  │   PDF canvas / <img> / <pre> /       │
│              │   MarkdownView / Drive <iframe>       │
│  1. Intro    │                                      │
│  2. Methods  │                                      │
│  3. Results  │                                      │
│              │                                      │
├──────────────┴──────────────────────────────────────┤
│  PDF: [◀ Prev]  Page 3 / 24  [Next ▶]   [pdf badge]│
└─────────────────────────────────────────────────────┘
```

Desktop: centered, `max-width: 900px`, `max-height: 90vh`. Mobile: full-screen overlay.

### Sub-renderers (all lazy / on-demand)

| Type | Renderer | Notes |
|---|---|---|
| `pdf` | `PdfViewer` | PDF.js dynamically imported; canvas render; ToC sidebar; prev/next |
| `image` | `ImageViewer` | `<img>` centered, `max-height: 80vh`; click outside closes |
| `text` | `TextViewer` | `.md` → `MarkdownView`; everything else → `<pre>` monospace |
| `drive` | `DriveViewer` | `<iframe>` fills content area; Drive handles its own nav |

### PDF viewer details

- `pdfjs-dist` imported dynamically inside `PdfViewer` only (not in the main bundle)
- `getOutline()` extracts ToC; sidebar hidden if PDF has no outline
- ToC item click scrolls to that page
- `←` / `→` arrow keys = prev/next page
- Loading state: spinner + "Loading PDF…" text

### Google Drive URL normalization

`drive.google.com/file/d/{id}/view?...` → `drive.google.com/file/d/{id}/preview`
`docs.google.com/...` passed through as-is (already embeddable)

### Interaction

- `Esc` closes modal
- Click backdrop closes modal
- `role="dialog"`, `aria-modal="true"`, focus trapped, focus returns to trigger on close

---

## 3. useFilePreview Hook

**File:** `src/hooks/useFilePreview.js`

```js
const { previewUrl, openPreview, closePreview } = useFilePreview()
```

State lives at the `Workspace` level in `App.jsx` and is passed down via props (no context needed — only `EntryCard` and `MarkdownView` consume it). `FilePreviewModal` rendered once at the `Workspace` root, conditionally shown when `previewUrl` is set.

---

## 4. Trigger Points

### 4a. Entry card URL (EntryCard.jsx)

When `classifyUrl(entry.url)` returns non-null, render a Preview button next to the title link:

```
[📄 paper.pdf ↗]  [Preview]
```

Title link still navigates normally. Preview button calls `openPreview(entry.url)`.

### 4b. Note body markdown links (MarkdownView.jsx)

Custom `components.a` renderer: checks each `href` with `classifyUrl`. If non-null, renders a file chip instead of a plain `<a>`:

```
[📄 paper.pdf]   [🖼 diagram.png]   [📝 notes.txt]
```

Clicking a chip calls `openPreview(href)`. Plain web URLs stay as normal `<a>` tags.

Direct inline images (`![alt](url)`) already render as `<img>` in markdown — these stay inline and do not open a modal.

---

## 5. NoteEditor Nudge

A one-time hint in the `NoteEditor` toolbar:

> "Tip: paste a .pdf, .jpg or Drive link for rich preview"

Shown once per browser session (dismissed with ×, stored in `localStorage` key `medialog_preview_tip_dismissed`). Appears below the toolbar, above the editor pane.

---

## 6. Smart Punctuation in NoteEditor

**Implementation:** A CodeMirror `keymap` extension added to `NoteEditor.jsx`, running at `Prec.high`.

### Auto-pair rules

| Keystroke | Inserted | Cursor |
|---|---|---|
| `*` (single) | `**` | between the two `*` |
| `**` (typed as second `*`) | `****` | between `**` and `**` |
| `_` | `__` | between the two `_` |
| `[` | `[]()` | inside `[` `]` |

### Backspace rules

- Cursor between empty pair (`*\|*`, `**\|**`, `_\|_`, `[\|]()`) → delete both sides
- Otherwise → default CodeMirror backspace

### Scope

NoteEditor (CodeMirror) only. QuickAdd's `<textarea>` is a quick-capture field and does not get auto-pairing.

---

## 7. Files Changed / Created

| File | Change |
|---|---|
| `src/lib/classifyUrl.js` | New — URL classifier |
| `src/components/FilePreviewModal.jsx` | New — unified modal |
| `src/hooks/useFilePreview.js` | New — modal state hook |
| `src/components/MarkdownView.jsx` | Update — file chip renderer in `components.a` |
| `src/components/EntryCard.jsx` | Update — preview button on classified URLs |
| `src/components/NoteEditor.jsx` | Update — smart punctuation keymap + nudge |
| `src/components/LinkEmbed.jsx` | Update — replace `isPdfUrl` with `classifyUrl` |
| `src/App.jsx` | Update — `useFilePreview` state, pass `openPreview` down |
| `src/styles.css` | Update — modal styles, file chip styles |

---

## 8. Dependencies

- `pdfjs-dist` — dynamically imported inside `PdfViewer` only. Add to `package.json` but it does not affect initial bundle size.

---

## Non-goals

- No Google Drive API / OAuth (embed-only via iframe)
- No video preview (YouTube already handled by existing thumbnail system)
- No attachment management UI (list/delete uploaded files) — out of scope
- No QuickAdd smart punctuation
