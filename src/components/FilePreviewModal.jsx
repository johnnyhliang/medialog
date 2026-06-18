import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { ExternalLink, X } from 'lucide-react'
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
  return (
    <img
      src={url}
      alt={fileName(url)}
      onError={(e) => { e.currentTarget.style.display = 'none' }}
    />
  )
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

const KNOWN_TYPES = ['pdf', 'image', 'text', 'drive']

export default function FilePreviewModal({ url, onClose }) {
  const overlayRef = useRef(null)
  const closeBtnRef = useRef(null)
  const type = classifyUrl(url)
  const name = fileName(url)
  const icon = FILE_ICONS[type] || '📎'

  // Escape key handler
  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  // Focus management: focus close button on open, restore on close
  useEffect(() => {
    const previousFocus = document.activeElement
    closeBtnRef.current?.focus()
    return () => {
      if (previousFocus && typeof previousFocus.focus === 'function') {
        previousFocus.focus()
      }
    }
  }, [])

  return (
    <div
      className="file-preview-overlay"
      ref={overlayRef}
      onClick={(e) => { if (e.target === overlayRef.current) onClose() }}
    >
      <div className="file-preview-modal" role="dialog" aria-modal="true" aria-label={`Preview: ${name}`}>
        <div className="file-preview-header">
          <span className="filename">{icon} {name}</span>
          <a href={url} target="_blank" rel="noreferrer" className="icon-btn" title="Open in new tab">
            <ExternalLink size={15} />
          </a>
          <button ref={closeBtnRef} className="icon-btn" onClick={onClose} aria-label="Close preview">
            <X size={15} />
          </button>
        </div>
        <div className="file-preview-body">
          <Suspense fallback={<p className="muted">Loading…</p>}>
            {type === 'pdf' ? (
              <PdfViewer url={url} />
            ) : (
              <div className="file-preview-content">
                {type === 'image' && <ImageViewer url={url} />}
                {type === 'text'  && <TextViewer url={url} />}
                {type === 'drive' && <DriveViewer url={url} />}
                {!KNOWN_TYPES.includes(type) && (
                  <p className="muted">
                    Preview not available.{' '}
                    <a href={url} target="_blank" rel="noreferrer">Open in new tab ↗</a>
                  </p>
                )}
              </div>
            )}
          </Suspense>
        </div>
      </div>
    </div>
  )
}
