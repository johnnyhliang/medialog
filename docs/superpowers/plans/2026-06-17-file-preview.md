# File Preview & Smart Editor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a unified lazy-loaded file preview modal (PDF with ToC, images, text, Google Drive) triggered from entry card URLs and note body links, plus smart auto-pair punctuation in the CodeMirror note editor.

**Architecture:** A `classifyUrl()` utility feeds a single `FilePreviewModal` (React.lazy) opened via a `useFilePreview` hook wired at the `Workspace` level. PDF.js is dynamically imported inside `PdfViewer` only — no bundle impact unless a PDF is opened. Trigger points are the entry card URL and a custom `<a>` renderer in `MarkdownView`.

**Tech Stack:** React 18, CodeMirror 6 (`@codemirror/state`, `@codemirror/view`), `pdfjs-dist@4`, Vitest + React Testing Library

## Global Constraints

- Node ESM — all new files use `export`/`import`, no `require`
- Tests colocated: `src/lib/foo.test.js` alongside `src/lib/foo.js`
- Run tests: `npm test -- --run`
- Warm off-white palette: use CSS variables from `styles.css` (`--bg`, `--surface`, `--border`, `--accent`, `--text`, `--muted`, `--radius`)
- No new CSS-in-JS — all styles go in `src/styles.css`
- React.lazy boundaries need `<Suspense>` wrappers

---

### Task 1: classifyUrl utility

**Files:**
- Create: `src/lib/classifyUrl.js`
- Create: `src/lib/classifyUrl.test.js`

**Interfaces:**
- Produces: `classifyUrl(url: string) → 'pdf' | 'image' | 'text' | 'drive' | null`

- [ ] **Step 1: Write the failing tests**

`src/lib/classifyUrl.test.js`:
```js
import { describe, test, expect } from 'vitest'
import { classifyUrl } from './classifyUrl.js'

describe('classifyUrl', () => {
  test('detects Google Drive file', () => {
    expect(classifyUrl('https://drive.google.com/file/d/abc123/view')).toBe('drive')
  })
  test('detects Google Docs', () => {
    expect(classifyUrl('https://docs.google.com/document/d/abc/edit')).toBe('drive')
  })
  test('detects PDF by extension', () => {
    expect(classifyUrl('https://example.com/paper.pdf')).toBe('pdf')
    expect(classifyUrl('https://example.com/PAPER.PDF')).toBe('pdf')
  })
  test('detects image extensions', () => {
    expect(classifyUrl('https://example.com/photo.jpg')).toBe('image')
    expect(classifyUrl('https://example.com/photo.PNG')).toBe('image')
    expect(classifyUrl('https://example.com/img.webp')).toBe('image')
    expect(classifyUrl('https://example.com/img.svg')).toBe('image')
  })
  test('detects text extensions', () => {
    expect(classifyUrl('https://example.com/notes.md')).toBe('text')
    expect(classifyUrl('https://example.com/data.csv')).toBe('text')
    expect(classifyUrl('https://example.com/readme.txt')).toBe('text')
  })
  test('returns null for plain web URLs', () => {
    expect(classifyUrl('https://example.com')).toBeNull()
    expect(classifyUrl('https://github.com/user/repo')).toBeNull()
  })
  test('returns null for empty/null input', () => {
    expect(classifyUrl('')).toBeNull()
    expect(classifyUrl(null)).toBeNull()
    expect(classifyUrl(undefined)).toBeNull()
  })
  test('Supabase storage URL classifies by extension', () => {
    expect(classifyUrl('https://bhxqgpgyxqnqvnqjvrrj.supabase.co/storage/v1/object/public/attachments/user/file.pdf')).toBe('pdf')
    expect(classifyUrl('https://bhxqgpgyxqnqvnqjvrrj.supabase.co/storage/v1/object/public/attachments/user/photo.jpg')).toBe('image')
  })
  test('URL with query string still classifies', () => {
    expect(classifyUrl('https://example.com/file.pdf?token=abc')).toBe('pdf')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```
npm test -- --run src/lib/classifyUrl.test.js
```
Expected: FAIL — "classifyUrl is not a function"

- [ ] **Step 3: Implement classifyUrl**

`src/lib/classifyUrl.js`:
```js
const IMAGE_EXTS = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'])
const TEXT_EXTS = new Set(['.txt', '.md', '.csv'])

export function classifyUrl(url) {
  if (!url || typeof url !== 'string') return null
  let pathname
  try {
    pathname = new URL(url).pathname.toLowerCase()
  } catch {
    return null
  }
  const hostname = new URL(url).hostname.toLowerCase()

  if (hostname === 'drive.google.com' || hostname === 'docs.google.com') return 'drive'

  const dot = pathname.lastIndexOf('.')
  if (dot === -1) return null
  const ext = pathname.slice(dot)

  if (ext === '.pdf') return 'pdf'
  if (IMAGE_EXTS.has(ext)) return 'image'
  if (TEXT_EXTS.has(ext)) return 'text'
  return null
}
```

- [ ] **Step 4: Run tests to verify they pass**

```
npm test -- --run src/lib/classifyUrl.test.js
```
Expected: all pass

- [ ] **Step 5: Commit**

```
git add src/lib/classifyUrl.js src/lib/classifyUrl.test.js
git commit -m "feat: classifyUrl utility for file type detection"
```

---

### Task 2: Modal styles + CSS

**Files:**
- Modify: `src/styles.css` (append at end)

**Interfaces:**
- Produces CSS classes: `.file-preview-overlay`, `.file-preview-modal`, `.file-preview-header`, `.file-preview-body`, `.file-preview-toc`, `.file-preview-content`, `.file-preview-footer`, `.file-chip`, `.preview-btn`

- [ ] **Step 1: Append modal + chip styles to styles.css**

Add to the end of `src/styles.css`:
```css
/* ── File Preview Modal ──────────────────────────────────────────────────────── */
.file-preview-overlay {
  position: fixed;
  inset: 0;
  background: rgba(28, 26, 21, 0.55);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 20px;
}

.file-preview-modal {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  width: 100%;
  max-width: 900px;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 8px 40px rgba(0,0,0,0.18);
  overflow: hidden;
}

.file-preview-header {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 16px;
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}
.file-preview-header .filename {
  flex: 1;
  font-size: 14px;
  font-weight: 600;
  color: var(--text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.file-preview-header a,
.file-preview-header button { flex-shrink: 0; }

.file-preview-body {
  display: flex;
  flex: 1;
  overflow: hidden;
  min-height: 0;
}

.file-preview-toc {
  width: 200px;
  flex-shrink: 0;
  border-right: 1px solid var(--border);
  overflow-y: auto;
  padding: 8px 0;
  background: var(--surface-2);
}
.file-preview-toc button {
  width: 100%;
  text-align: left;
  background: transparent;
  border: none;
  padding: 5px 12px;
  font-size: 12.5px;
  color: var(--muted);
  border-radius: 0;
  line-height: 1.4;
}
.file-preview-toc button:hover { background: var(--surface-3); color: var(--text); }
.file-preview-toc .toc-label {
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.6px;
  color: var(--muted);
  padding: 6px 12px 4px;
}

.file-preview-content {
  flex: 1;
  overflow: auto;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding: 16px;
  min-width: 0;
}
.file-preview-content img {
  max-width: 100%;
  max-height: calc(90vh - 120px);
  object-fit: contain;
  border-radius: 4px;
}
.file-preview-content pre {
  margin: 0;
  font-family: 'Courier New', monospace;
  font-size: 13px;
  line-height: 1.6;
  color: var(--text);
  white-space: pre-wrap;
  word-break: break-word;
  width: 100%;
}
.file-preview-content iframe {
  width: 100%;
  height: calc(90vh - 130px);
  border: none;
}
.file-preview-content canvas {
  max-width: 100%;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
}

.file-preview-footer {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 16px;
  border-top: 1px solid var(--border);
  flex-shrink: 0;
  font-size: 13px;
  color: var(--muted);
}
.file-preview-footer .page-info { margin: 0 4px; }

/* ── File chips (inline note links) ─────────────────────────────────────────── */
.file-chip {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 2px 9px;
  border-radius: 6px;
  background: var(--surface-2);
  border: 1px solid var(--border);
  font-size: 12.5px;
  color: var(--accent);
  cursor: pointer;
  text-decoration: none;
  transition: background 0.1s;
}
.file-chip:hover { background: var(--surface-3); text-decoration: none; }

/* ── Preview button (entry card) ─────────────────────────────────────────────── */
.preview-btn {
  font-size: 11.5px;
  padding: 2px 8px;
  background: var(--surface-2);
  border: 1px solid var(--border);
  color: var(--muted);
  border-radius: 6px;
  flex-shrink: 0;
}
.preview-btn:hover { background: var(--accent-weak); color: var(--accent); border-color: var(--accent); }

/* ── NoteEditor tip ──────────────────────────────────────────────────────────── */
.note-editor-tip {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: var(--muted);
  padding: 5px 10px;
  background: var(--surface-2);
  border-bottom: 1px solid var(--border);
}
.note-editor-tip button {
  background: none;
  border: none;
  color: var(--muted);
  padding: 0 2px;
  font-size: 14px;
  line-height: 1;
}

@media (max-width: 680px) {
  .file-preview-overlay { padding: 0; }
  .file-preview-modal { max-width: 100%; max-height: 100vh; border-radius: 0; }
  .file-preview-toc { display: none; }
}
```

- [ ] **Step 2: Commit**

```
git add src/styles.css
git commit -m "feat: file preview modal + chip CSS"
```

---

### Task 3: useFilePreview hook + modal shell

**Files:**
- Create: `src/hooks/useFilePreview.js`
- Create: `src/components/FilePreviewModal.jsx`
- Modify: `src/App.jsx` (wire hook + render modal)

**Interfaces:**
- Consumes: `classifyUrl` from `../lib/classifyUrl.js`
- Produces:
  - `useFilePreview()` → `{ previewUrl, openPreview(url), closePreview() }`
  - `<FilePreviewModal url={string} onClose={fn} />` — rendered at Workspace root

- [ ] **Step 1: Create useFilePreview hook**

`src/hooks/useFilePreview.js`:
```js
import { useState, useCallback } from 'react'

export function useFilePreview() {
  const [previewUrl, setPreviewUrl] = useState(null)
  const openPreview = useCallback((url) => setPreviewUrl(url), [])
  const closePreview = useCallback(() => setPreviewUrl(null), [])
  return { previewUrl, openPreview, closePreview }
}
```

- [ ] **Step 2: Create FilePreviewModal shell**

`src/components/FilePreviewModal.jsx`:
```jsx
import { lazy, Suspense, useEffect, useRef } from 'react'
import { classifyUrl } from '../lib/classifyUrl.js'

const PdfViewer = lazy(() => import('./PdfViewer.jsx'))

const FILE_ICONS = { pdf: '📄', image: '🖼', text: '📝', drive: '🔗' }

function fileName(url) {
  try {
    const parts = new URL(url).pathname.split('/')
    return decodeURIComponent(parts[parts.length - 1] || url)
  } catch {
    return url
  }
}

function normalizeDriveUrl(url) {
  try {
    const u = new URL(url)
    if (u.hostname === 'drive.google.com') {
      const m = u.pathname.match(/\/file\/d\/([^/]+)/)
      if (m) return `https://drive.google.com/file/d/${m[1]}/preview`
    }
    return url
  } catch {
    return url
  }
}

function ImageViewer({ url }) {
  return <img src={url} alt={fileName(url)} />
}

function TextViewer({ url }) {
  const [text, setText] = import('react').useState('Loading…')
  import('react').useEffect(() => {
    fetch(url)
      .then((r) => r.text())
      .then(setText)
      .catch(() => setText('Could not load file.'))
  }, [url])
  const isMarkdown = url.toLowerCase().endsWith('.md')
  if (isMarkdown) {
    const MarkdownView = lazy(() => import('./MarkdownView.jsx'))
    return (
      <Suspense fallback={<pre>Loading…</pre>}>
        <MarkdownView>{text}</MarkdownView>
      </Suspense>
    )
  }
  return <pre>{text}</pre>
}

function DriveViewer({ url }) {
  return <iframe src={normalizeDriveUrl(url)} title="Google Drive preview" allowFullScreen />
}

export default function FilePreviewModal({ url, onClose }) {
  const overlayRef = useRef(null)
  const type = classifyUrl(url)
  const name = fileName(url)
  const icon = FILE_ICONS[type] || '📎'

  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  function onOverlayClick(e) {
    if (e.target === overlayRef.current) onClose()
  }

  return (
    <div className="file-preview-overlay" ref={overlayRef} onClick={onOverlayClick}>
      <div className="file-preview-modal" role="dialog" aria-modal="true" aria-label={`Preview: ${name}`}>
        <div className="file-preview-header">
          <span className="filename">{icon} {name}</span>
          <a href={url} target="_blank" rel="noreferrer" className="icon-btn" title="Open in new tab">↗</a>
          <button className="icon-btn" onClick={onClose} aria-label="Close preview">✕</button>
        </div>

        <div className="file-preview-body">
          <div className="file-preview-content">
            <Suspense fallback={<p className="muted">Loading…</p>}>
              {type === 'pdf' && <PdfViewer url={url} />}
              {type === 'image' && <ImageViewer url={url} />}
              {type === 'text' && <TextViewer url={url} />}
              {type === 'drive' && <DriveViewer url={url} />}
            </Suspense>
          </div>
        </div>
      </div>
    </div>
  )
}
```

**Note:** `TextViewer` uses inline `import('react').useState` because it's defined inside the module but outside a component export — fix this by moving the hooks to the top level. Replace the TextViewer function with:

```jsx
function TextViewer({ url }) {
  const [text, setText] = useState('Loading…')
  useEffect(() => {
    fetch(url)
      .then((r) => r.text())
      .then(setText)
      .catch(() => setText('Could not load file.'))
  }, [url])
  const isMarkdown = url.toLowerCase().endsWith('.md')
  if (isMarkdown) {
    return <MarkdownView>{text}</MarkdownView>
  }
  return <pre>{text}</pre>
}
```

And add to the imports at the top:
```jsx
import { lazy, Suspense, useEffect, useState } from 'react'
import MarkdownView from './MarkdownView.jsx'
```

**Full corrected `src/components/FilePreviewModal.jsx`:**
```jsx
import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { classifyUrl } from '../lib/classifyUrl.js'
import MarkdownView from './MarkdownView.jsx'

const PdfViewer = lazy(() => import('./PdfViewer.jsx'))

const FILE_ICONS = { pdf: '📄', image: '🖼', text: '📝', drive: '🔗' }

function fileName(url) {
  try {
    const parts = new URL(url).pathname.split('/')
    return decodeURIComponent(parts[parts.length - 1] || url)
  } catch {
    return url
  }
}

function normalizeDriveUrl(url) {
  try {
    const u = new URL(url)
    if (u.hostname === 'drive.google.com') {
      const m = u.pathname.match(/\/file\/d\/([^/]+)/)
      if (m) return `https://drive.google.com/file/d/${m[1]}/preview`
    }
    return url
  } catch {
    return url
  }
}

function ImageViewer({ url }) {
  return <img src={url} alt={fileName(url)} />
}

function TextViewer({ url }) {
  const [text, setText] = useState('Loading…')
  useEffect(() => {
    fetch(url)
      .then((r) => r.text())
      .then(setText)
      .catch(() => setText('Could not load file.'))
  }, [url])
  if (url.toLowerCase().endsWith('.md')) {
    return <MarkdownView>{text}</MarkdownView>
  }
  return <pre>{text}</pre>
}

function DriveViewer({ url }) {
  return <iframe src={normalizeDriveUrl(url)} title="Google Drive preview" allowFullScreen />
}

export default function FilePreviewModal({ url, onClose }) {
  const overlayRef = useRef(null)
  const type = classifyUrl(url)
  const name = fileName(url)
  const icon = FILE_ICONS[type] || '📎'

  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      className="file-preview-overlay"
      ref={overlayRef}
      onClick={(e) => { if (e.target === overlayRef.current) onClose() }}
    >
      <div className="file-preview-modal" role="dialog" aria-modal="true" aria-label={`Preview: ${name}`}>
        <div className="file-preview-header">
          <span className="filename">{icon} {name}</span>
          <a href={url} target="_blank" rel="noreferrer" className="icon-btn" title="Open in new tab">↗</a>
          <button className="icon-btn" onClick={onClose} aria-label="Close preview">✕</button>
        </div>
        <div className="file-preview-body">
          <div className="file-preview-content">
            <Suspense fallback={<p className="muted">Loading…</p>}>
              {type === 'pdf'   && <PdfViewer url={url} />}
              {type === 'image' && <ImageViewer url={url} />}
              {type === 'text'  && <TextViewer url={url} />}
              {type === 'drive' && <DriveViewer url={url} />}
            </Suspense>
          </div>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Wire useFilePreview into App.jsx**

In `src/App.jsx`:

Add import at top:
```js
import { lazy, Suspense } from 'react'  // add lazy, Suspense to existing react import
import { useFilePreview } from './hooks/useFilePreview.js'
const FilePreviewModal = lazy(() => import('./components/FilePreviewModal.jsx'))
```

Inside `Workspace()`, add after the existing state declarations:
```js
const { previewUrl, openPreview, closePreview } = useFilePreview()
```

Pass `openPreview` down to `EntryList`:
```jsx
<EntryList
  entries={...}
  onDelete={handleDelete}
  onStatusChange={handleStatusChange}
  onTagsChange={handleTagsChange}
  onTogglePin={handleTogglePin}
  onNoteSave={handleNoteSave}
  onPreview={openPreview}
/>
```

Add modal at the bottom of the `Workspace` return, just before the closing `</div>`:
```jsx
{previewUrl && (
  <Suspense fallback={null}>
    <FilePreviewModal url={previewUrl} onClose={closePreview} />
  </Suspense>
)}
```

Also update `EntryList.jsx` to pass `onPreview` through to `EntryCard`. Open `src/components/EntryList.jsx` and add `onPreview` to both props and the `<EntryCard>` render.

- [ ] **Step 4: Commit**

```
git add src/hooks/useFilePreview.js src/components/FilePreviewModal.jsx src/App.jsx
git commit -m "feat: FilePreviewModal shell + useFilePreview hook"
```

---

### Task 4: PdfViewer with PDF.js ToC + navigation

**Files:**
- Create: `src/components/PdfViewer.jsx`

**Interfaces:**
- Consumes: `url: string` prop
- Produces: PDF rendered in canvas with optional ToC sidebar and prev/next navigation

- [ ] **Step 1: Install pdfjs-dist**

```
npm install pdfjs-dist@4
```

- [ ] **Step 2: Create PdfViewer**

`src/components/PdfViewer.jsx`:
```jsx
import { useEffect, useRef, useState } from 'react'

export default function PdfViewer({ url }) {
  const canvasRef = useRef(null)
  const [pdfDoc, setPdfDoc] = useState(null)
  const [pageNum, setPageNum] = useState(1)
  const [numPages, setNumPages] = useState(0)
  const [outline, setOutline] = useState([])
  const [error, setError] = useState(null)
  const renderTaskRef = useRef(null)

  // Load PDF.js dynamically — only imported when this component mounts
  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const pdfjsLib = await import('pdfjs-dist')
        pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
          'pdfjs-dist/build/pdf.worker.min.mjs',
          import.meta.url
        ).href

        const doc = await pdfjsLib.getDocument(url).promise
        if (cancelled) return
        setPdfDoc(doc)
        setNumPages(doc.numPages)

        const toc = await doc.getOutline()
        if (!cancelled) setOutline(toc || [])
      } catch (err) {
        if (!cancelled) setError(err.message || 'Failed to load PDF')
      }
    }
    load()
    return () => { cancelled = true }
  }, [url])

  // Render current page whenever pdfDoc or pageNum changes
  useEffect(() => {
    if (!pdfDoc || !canvasRef.current) return
    let cancelled = false

    async function render() {
      if (renderTaskRef.current) {
        renderTaskRef.current.cancel()
      }
      const page = await pdfDoc.getPage(pageNum)
      if (cancelled) return

      const viewport = page.getViewport({ scale: 1.5 })
      const canvas = canvasRef.current
      canvas.width = viewport.width
      canvas.height = viewport.height
      const ctx = canvas.getContext('2d')

      renderTaskRef.current = page.render({ canvasContext: ctx, viewport })
      try {
        await renderTaskRef.current.promise
      } catch {
        // cancelled — ignore
      }
    }
    render()
    return () => { cancelled = true }
  }, [pdfDoc, pageNum])

  // Arrow key navigation
  useEffect(() => {
    function onKey(e) {
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        setPageNum((p) => Math.min(p + 1, numPages))
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        setPageNum((p) => Math.max(p - 1, 1))
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [numPages])

  async function goToOutlineItem(item) {
    if (!pdfDoc || !item.dest) return
    try {
      let dest = item.dest
      if (typeof dest === 'string') {
        dest = await pdfDoc.getDestination(dest)
      }
      const ref = dest[0]
      const idx = await pdfDoc.getPageIndex(ref)
      setPageNum(idx + 1)
    } catch {
      // dest format not supported — ignore
    }
  }

  if (error) return <p className="muted">⚠ {error}</p>
  if (!pdfDoc) return <p className="muted">Loading PDF…</p>

  return (
    <>
      {outline.length > 0 && (
        <div className="file-preview-toc">
          <div className="toc-label">Contents</div>
          {outline.map((item, i) => (
            <button key={i} onClick={() => goToOutlineItem(item)} title={item.title}>
              {item.title}
            </button>
          ))}
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, flex: 1, overflow: 'auto', padding: 16 }}>
        <canvas ref={canvasRef} />
        <div className="file-preview-footer">
          <button className="icon-btn" onClick={() => setPageNum((p) => Math.max(p - 1, 1))} disabled={pageNum <= 1}>◀</button>
          <span className="page-info">Page {pageNum} / {numPages}</span>
          <button className="icon-btn" onClick={() => setPageNum((p) => Math.min(p + 1, numPages))} disabled={pageNum >= numPages}>▶</button>
        </div>
      </div>
    </>
  )
}
```

- [ ] **Step 3: Verify PDF.js worker resolves in Vite**

Start dev server:
```
npm run dev
```

Open the app, open any entry, paste a PDF URL (e.g. `https://www.w3.org/WAI/WCAG21/wcag21.pdf`) as the entry URL, click Preview. The PDF should load and render. Check browser console for errors.

- [ ] **Step 4: Commit**

```
git add src/components/PdfViewer.jsx package.json package-lock.json
git commit -m "feat: PdfViewer with PDF.js ToC and page navigation"
```

---

### Task 5: Trigger points — entry card + markdown links

**Files:**
- Modify: `src/components/EntryCard.jsx`
- Modify: `src/components/EntryList.jsx`
- Modify: `src/components/MarkdownView.jsx`
- Modify: `src/components/LinkEmbed.jsx`

**Interfaces:**
- Consumes: `classifyUrl` from `../lib/classifyUrl.js`; `openPreview(url)` prop on EntryCard

- [ ] **Step 1: Update EntryList to pass onPreview through**

In `src/components/EntryList.jsx`, read the current file then add `onPreview` prop:
```jsx
export default function EntryList({ entries, onDelete, onStatusChange, onTagsChange, onTogglePin, onNoteSave, onPreview }) {
  return (
    <div>
      {entries.map((entry) => (
        <EntryCard
          key={entry.id}
          entry={entry}
          onDelete={onDelete}
          onStatusChange={onStatusChange}
          onTagsChange={onTagsChange}
          onTogglePin={onTogglePin}
          onNoteSave={onNoteSave}
          onPreview={onPreview}
        />
      ))}
    </div>
  )
}
```

- [ ] **Step 2: Add preview button to EntryCard**

In `src/components/EntryCard.jsx`, add import:
```js
import { classifyUrl } from '../lib/classifyUrl.js'
```

Update the component signature:
```js
export default function EntryCard({ entry, onDelete, onStatusChange, onTagsChange, onTogglePin, onNoteSave, onPreview }) {
```

Add after the `const thumb = ...` line:
```js
const fileType = classifyUrl(entry.url)
```

Replace the title/URL section (the existing `{entry.url ? (...) : ...}` block) with:
```jsx
{entry.url ? (
  <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
    <a href={entry.url} className="card-title" target="_blank" rel="noreferrer">
      {entry.title || entry.url}
    </a>
    {fileType && onPreview && (
      <button className="preview-btn" onClick={() => onPreview(entry.url)}>
        Preview
      </button>
    )}
  </div>
) : entry.title ? (
  <span className="card-title">{entry.title}</span>
) : null}
```

- [ ] **Step 3: Update MarkdownView to render file chips**

In `src/components/MarkdownView.jsx`:

Add import:
```js
import { classifyUrl } from '../lib/classifyUrl.js'
```

Update `buildMarkdownComponents` to accept `onPreview` and replace the `a` renderer:
```jsx
export function buildMarkdownComponents(onPreview) {
  const FILE_ICONS = { pdf: '📄', image: '🖼', text: '📝', drive: '🔗' }

  return {
    a: ({ href, children, ...props }) => {
      const fileType = href ? classifyUrl(href) : null
      if (fileType && onPreview) {
        return (
          <button className="file-chip" onClick={() => onPreview(href)}>
            {FILE_ICONS[fileType]} {children}
          </button>
        )
      }
      if (href && isPdfUrl(href)) {
        return <LinkEmbed url={href} />
      }
      return <a href={href} target="_blank" rel="noreferrer" {...props}>{children}</a>
    },
    p: ({ node, children, ...props }) => {
      const href = isParagraphOnlyLink(node)
      if (href && shouldEmbedLink(href)) {
        return <LinkEmbed url={href} />
      }
      return <p {...props}>{children}</p>
    },
    img: ({ src, alt, ...props }) => (
      <img
        className="note-image"
        src={src}
        alt={alt ?? ''}
        loading="lazy"
        {...props}
      />
    ),
  }
}
```

Update `MarkdownView` to accept and pass `onPreview`:
```jsx
export default function MarkdownView({ children, className = 'note', onPreview }) {
  const mdComponents = buildMarkdownComponents(onPreview)
  return (
    <div className={className}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>
        {children}
      </ReactMarkdown>
    </div>
  )
}
```

Remove the module-level `const mdComponents = buildMarkdownComponents()` line (it's now computed per render).

- [ ] **Step 4: Update LinkEmbed to use classifyUrl**

In `src/components/LinkEmbed.jsx`, add import:
```js
import { classifyUrl } from '../lib/classifyUrl.js'
```

Replace:
```js
export function isPdfUrl(url) {
  if (!url) return false
  try {
    const path = new URL(url).pathname.toLowerCase()
    return path.endsWith('.pdf')
  } catch {
    return url.toLowerCase().includes('.pdf')
  }
}
```
With:
```js
export function isPdfUrl(url) {
  return classifyUrl(url) === 'pdf'
}
```

- [ ] **Step 5: Pass onPreview to MarkdownView in EntryCard**

In `src/components/EntryCard.jsx`, find the two uses of `<MarkdownView>` (in the note display) and pass `onPreview`:
```jsx
<div className="note" onClick={startEditing} style={{ cursor: 'text' }}>
  <MarkdownView onPreview={onPreview}>{entry.note}</MarkdownView>
</div>
```

- [ ] **Step 6: Run tests**

```
npm test -- --run
```

Expected: same pass count as before (pre-existing 4 failures unchanged)

- [ ] **Step 7: Commit**

```
git add src/components/EntryCard.jsx src/components/EntryList.jsx src/components/MarkdownView.jsx src/components/LinkEmbed.jsx
git commit -m "feat: file preview triggers on entry URL and markdown links"
```

---

### Task 6: Smart punctuation in NoteEditor

**Files:**
- Modify: `src/components/NoteEditor.jsx`

**Interfaces:**
- Consumes: `@codemirror/state` (`EditorSelection`), `@codemirror/view` (`keymap`), `@codemirror/state` (`Prec`) — all already installed

- [ ] **Step 1: Write the keymap extension**

Add this function to `src/components/NoteEditor.jsx` (above the `NoteEditor` component, after the existing imports):

```js
import { EditorSelection } from '@codemirror/state'

function makePairKeymap() {
  function insertPair(open, close) {
    return (view) => {
      const { state, dispatch } = view
      const sel = state.selection.main
      // If text is selected, wrap it
      if (sel.from !== sel.to) {
        const selected = state.sliceDoc(sel.from, sel.to)
        dispatch(state.update({
          changes: { from: sel.from, to: sel.to, insert: `${open}${selected}${close}` },
          selection: EditorSelection.cursor(sel.from + open.length + selected.length),
        }))
        return true
      }
      // Insert pair and place cursor inside
      dispatch(state.update({
        changes: { from: sel.from, to: sel.to, insert: `${open}${close}` },
        selection: EditorSelection.cursor(sel.from + open.length),
      }))
      return true
    }
  }

  function smartBackspace(view) {
    const { state, dispatch } = view
    const { from } = state.selection.main
    if (from === 0) return false

    // Check **|**
    const b2 = state.sliceDoc(from - 2, from)
    const a2 = state.sliceDoc(from, from + 2)
    if (b2 === '**' && a2 === '**') {
      dispatch(state.update({
        changes: { from: from - 2, to: from + 2, insert: '' },
        selection: EditorSelection.cursor(from - 2),
      }))
      return true
    }

    // Check *|* or _|_
    const b1 = state.sliceDoc(from - 1, from)
    const a1 = state.sliceDoc(from, from + 1)
    if ((b1 === '*' && a1 === '*') || (b1 === '_' && a1 === '_')) {
      dispatch(state.update({
        changes: { from: from - 1, to: from + 1, insert: '' },
        selection: EditorSelection.cursor(from - 1),
      }))
      return true
    }

    // Check [|]
    if (b1 === '[' && a1 === ']') {
      dispatch(state.update({
        changes: { from: from - 1, to: from + 1, insert: '' },
        selection: EditorSelection.cursor(from - 1),
      }))
      return true
    }

    return false
  }

  return Prec.high(
    keymap.of([
      { key: '*', run: insertPair('*', '*') },
      { key: '_', run: insertPair('_', '_') },
      { key: '[', run: insertPair('[', ']') },
      { key: 'Backspace', run: smartBackspace },
    ])
  )
}

const pairKeymap = makePairKeymap()
```

- [ ] **Step 2: Add pairKeymap to CodeMirror extensions**

In the `<CodeMirror>` element inside `NoteEditor`, update the `extensions` prop:
```jsx
extensions={[
  markdown({ base: markdownLanguage, codeLanguages: languages }),
  mdKeymap,
  pairKeymap,
]}
```

- [ ] **Step 3: Manual test**

Start dev server (`npm run dev`), open an entry, click the note area to open CodeMirror editor.

Verify:
- Type `*` → inserts `**` with cursor between them
- Type `_` → inserts `__` with cursor between them
- Type `[` → inserts `[]` with cursor inside
- With text selected, type `*` → wraps selection in `*...*`
- Inside `*|*` hit backspace → both `*` deleted
- Inside `**|**` hit backspace → all four `*` deleted

- [ ] **Step 4: Commit**

```
git add src/components/NoteEditor.jsx
git commit -m "feat: smart auto-pair punctuation in CodeMirror editor"
```

---

### Task 7: NoteEditor file link nudge

**Files:**
- Modify: `src/components/NoteEditor.jsx`

- [ ] **Step 1: Add tip state + dismiss logic**

In `NoteEditor.jsx`, add inside the component (alongside existing `useState` calls):
```js
const [showTip, setShowTip] = useState(
  () => !localStorage.getItem('medialog_preview_tip_dismissed')
)

function dismissTip() {
  localStorage.setItem('medialog_preview_tip_dismissed', '1')
  setShowTip(false)
}
```

- [ ] **Step 2: Render the tip below the toolbar**

In the NoteEditor JSX, after the closing `</div>` of `.note-editor-toolbar` and before `{uploadError && ...}`:
```jsx
{showTip && (
  <div className="note-editor-tip">
    <span>💡 Paste a .pdf, .jpg or Google Drive link for rich inline preview</span>
    <button onClick={dismissTip} aria-label="Dismiss tip">✕</button>
  </div>
)}
```

- [ ] **Step 3: Run full test suite**

```
npm test -- --run
```

Expected: same result as before

- [ ] **Step 4: Final manual smoke test**

- Open the app, open Settings — confirm no crash
- Add an entry with a YouTube URL — thumbnail shows, no preview button
- Add an entry with a `.pdf` URL — Preview button appears, clicking opens modal
- Add an entry with a Google Drive URL — Preview button appears, clicking opens Drive iframe
- In a note, type `[my pdf](https://example.com/doc.pdf)` — renders as a `📄 my pdf` chip, clicking opens modal
- Open NoteEditor — tip shows; click ✕ — tip hides; reload — tip stays hidden
- Type `*` in editor → `**`, backspace from inside → gone

- [ ] **Step 5: Commit**

```
git add src/components/NoteEditor.jsx
git commit -m "feat: one-time file preview nudge in note editor"
```
