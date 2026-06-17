import { useState, useRef } from 'react'
import CodeMirror from '@uiw/react-codemirror'
import { markdown, markdownLanguage, insertNewlineContinueMarkup, deleteMarkupBackward } from '@codemirror/lang-markdown'
import { languages } from '@codemirror/language-data'
import { keymap } from '@codemirror/view'
import { indentWithTab } from '@codemirror/commands'
import { Prec } from '@codemirror/state'
import MarkdownView from './MarkdownView.jsx'
import { uploadAttachment, markdownForAttachment, isAllowedAttachment } from '../lib/storage.js'

const mdKeymap = Prec.high(
  keymap.of([
    { key: 'Enter', run: insertNewlineContinueMarkup },
    { key: 'Backspace', run: deleteMarkupBackward },
    indentWithTab,
  ]),
)

const MODES = ['write', 'preview', 'split']

function insertAtCursor(value, snippet) {
  if (!value) return snippet
  const trimmed = value.replace(/\s*$/, '')
  return trimmed ? `${trimmed}\n\n${snippet}` : snippet
}

export default function NoteEditor({ value, onChange, supabase }) {
  const [mode, setMode] = useState('write')
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState(null)
  const fileRef = useRef(null)

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
        const url = await uploadAttachment(supabase, file)
        next = insertAtCursor(next, markdownForAttachment(url, file))
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

      {uploadError && <p className="note-editor-error">{uploadError}</p>}

      <div className={`note-editor-panes mode-${mode}`}>
        {showEditor && (
          <div className="note-editor-pane" onPaste={onPaste}>
            <CodeMirror
              value={value}
              theme="dark"
              extensions={[markdown({ base: markdownLanguage, codeLanguages: languages }), mdKeymap]}
              onChange={onChange}
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
