import { useMemo, useState, useRef } from 'react'
import { Bold, Italic, Heading, List, ListChecks, Link2, Quote, Code } from 'lucide-react'
import CodeMirror from '@uiw/react-codemirror'
import { markdown, markdownLanguage, insertNewlineContinueMarkup, deleteMarkupBackward } from '@codemirror/lang-markdown'
import { languages } from '@codemirror/language-data'
import { keymap } from '@codemirror/view'
import { indentWithTab } from '@codemirror/commands'
import { Prec, EditorSelection } from '@codemirror/state'
import MarkdownView from './MarkdownView.jsx'
import { uploadAttachment, markdownForAttachment, isAllowedAttachment } from '../lib/storage.js'

const mdKeymap = Prec.high(
  keymap.of([
    { key: 'Enter', run: insertNewlineContinueMarkup },
    { key: 'Backspace', run: deleteMarkupBackward },
    indentWithTab,
  ]),
)

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

  return Prec.highest(
    keymap.of([
      { key: '*', run: insertPair('*', '*') },
      { key: '_', run: insertPair('_', '_') },
      { key: '[', run: insertPair('[', ']') },
      { key: 'Backspace', run: smartBackspace },
    ])
  )
}

const pairKeymap = makePairKeymap()

// Hoisted so the extension identity is stable across renders — rebuilding it
// per render makes CodeMirror reconfigure the whole instance on every keystroke.
const mdLang = markdown({ base: markdownLanguage, codeLanguages: languages })
const NO_EXTENSIONS = []

const MODES = ['write', 'preview', 'split']

function insertAtCursor(value, snippet) {
  if (!value) return snippet
  const trimmed = value.replace(/\s*$/, '')
  return trimmed ? `${trimmed}\n\n${snippet}` : snippet
}

// Format actions operate directly on the CodeMirror view so they work
// identically on mobile (where typing `*` or `#` by hand is painful) and desktop.
function wrapSelection(view, open, close = open) {
  const { state } = view
  const sel = state.selection.main
  const selected = state.sliceDoc(sel.from, sel.to)
  view.dispatch(state.update({
    changes: { from: sel.from, to: sel.to, insert: `${open}${selected}${close}` },
    selection: selected
      ? EditorSelection.range(sel.from + open.length, sel.from + open.length + selected.length)
      : EditorSelection.cursor(sel.from + open.length),
  }))
  view.focus()
}

function prefixLines(view, prefix, { numbered = false } = {}) {
  const { state } = view
  const sel = state.selection.main
  const fromLine = state.doc.lineAt(sel.from)
  const toLine = state.doc.lineAt(sel.to)
  const changes = []
  let n = 1
  for (let ln = fromLine.number; ln <= toLine.number; ln++) {
    const line = state.doc.line(ln)
    const mark = numbered ? `${n++}. ` : prefix
    changes.push({ from: line.from, to: line.from, insert: mark })
  }
  view.dispatch(state.update({ changes }))
  view.focus()
}

export default function NoteEditor({ value, onChange, supabase, extraExtensions = NO_EXTENSIONS }) {
  const extensions = useMemo(
    () => [mdLang, mdKeymap, pairKeymap, ...extraExtensions],
    [extraExtensions],
  )
  const viewRef = useRef(null)
  const fmt = (fn) => () => { if (viewRef.current) fn(viewRef.current) }
  const FORMATS = [
    { icon: Bold, label: 'Bold', run: (v) => wrapSelection(v, '**') },
    { icon: Italic, label: 'Italic', run: (v) => wrapSelection(v, '_') },
    { icon: Heading, label: 'Heading', run: (v) => prefixLines(v, '## ') },
    { icon: List, label: 'Bullet list', run: (v) => prefixLines(v, '- ') },
    { icon: ListChecks, label: 'Checklist', run: (v) => prefixLines(v, '- [ ] ') },
    { icon: Quote, label: 'Quote', run: (v) => prefixLines(v, '> ') },
    { icon: Code, label: 'Code', run: (v) => wrapSelection(v, '`') },
    { icon: Link2, label: 'Link', run: (v) => wrapSelection(v, '[', '](url)') },
  ]
  const [mode, setMode] = useState('write')
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState(null)
  const fileRef = useRef(null)
  const [showTip, setShowTip] = useState(
    () => !localStorage.getItem('medialog_preview_tip_dismissed')
  )

  function dismissTip() {
    localStorage.setItem('medialog_preview_tip_dismissed', '1')
    setShowTip(false)
  }

  async function attachFiles(files) {
    if (!supabase || !files?.length) return
    setUploadError(null)
    setUploading(true)
    let next = value
    try {
      for (const file of files) {
        if (!isAllowedAttachment(file)) {
          throw new Error(`${file.name}: images or PDFs only, max 10 MB`)
        }
        const { url, thumbUrl } = await uploadAttachment(supabase, file)
        next = insertAtCursor(next, markdownForAttachment(url, thumbUrl, file))
      }
      onChange(next)
    } catch (err) {
      setUploadError(err.message || 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  function onPaste(e) {
    const items = [...(e.clipboardData?.items ?? [])]
    const files = items
      .filter((item) => item.kind === 'file')
      .map((item) => item.getAsFile())
      .filter(Boolean)
    if (!files.length) return
    e.preventDefault()
    attachFiles(files)
  }

  function onDrop(e) {
    e.preventDefault()
    const files = [...(e.dataTransfer?.files ?? [])]
    if (files.length) attachFiles(files)
  }

  const showEditor = mode === 'write' || mode === 'split'
  const showPreview = mode === 'preview' || mode === 'split'

  return (
    <div className="note-editor" onDrop={onDrop} onDragOver={(e) => e.preventDefault()}>
      <div className="note-editor-toolbar">
        <div className="note-editor-modes" role="tablist" aria-label="Editor mode">
          {MODES.map((m) => (
            <button
              key={m}
              type="button"
              role="tab"
              aria-selected={mode === m}
              className={mode === m ? 'active' : ''}
              onClick={() => setMode(m)}
            >
              {m}
            </button>
          ))}
        </div>
        {showEditor && (
          <div className="note-editor-format" role="toolbar" aria-label="Formatting">
            {FORMATS.map(({ icon: Icon, label, run }) => (
              <button
                key={label}
                type="button"
                title={label}
                aria-label={label}
                onMouseDown={(e) => e.preventDefault()}
                onClick={fmt(run)}
              >
                <Icon size={16} strokeWidth={2} />
              </button>
            ))}
          </div>
        )}
        {supabase && (
          <div className="note-editor-attach">
            <input
              ref={fileRef}
              type="file"
              accept="image/*,application/pdf"
              multiple
              hidden
              onChange={(e) => {
                attachFiles([...e.target.files])
                e.target.value = ''
              }}
            />
            <button
              type="button"
              disabled={uploading}
              onClick={() => fileRef.current?.click()}
            >
              {uploading ? 'Uploading…' : 'Attach'}
            </button>
          </div>
        )}
      </div>

      {showTip && (
        <div className="note-editor-tip">
          <span>💡 Paste a .pdf, .jpg or Google Drive link for rich inline preview</span>
          <button onClick={dismissTip} aria-label="Dismiss tip">✕</button>
        </div>
      )}

      {uploadError && <p className="note-editor-error">{uploadError}</p>}

      <div className={`note-editor-panes mode-${mode}`}>
        {showEditor && (
          <div className="note-editor-pane" onPaste={onPaste}>
            <CodeMirror
              value={value}
              extensions={extensions}
              onChange={onChange}
              height="auto"
              minHeight="160px"
              onCreateEditor={(view) => { viewRef.current = view }}
              basicSetup={{ lineNumbers: false, foldGutter: false, highlightActiveLine: false }}
            />
          </div>
        )}
        {showPreview && (
          <MarkdownView className="note note-preview">
            {value || '*Nothing to preview yet.*'}
          </MarkdownView>
        )}
      </div>
    </div>
  )
}
