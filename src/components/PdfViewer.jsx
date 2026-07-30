import { useState } from 'react'

// PDFs render in the browser's own viewer via <iframe>, not pdf.js.
//
// pdf.js cost ~1.7 MB of shipped assets (a 1.3 MB worker plus a 357 KB chunk) —
// by far the largest thing in the build — to reimplement what every browser
// already does natively, and does better: real text selection, find-in-page,
// zoom, print, and continuous scroll instead of one canvas page at a time. The
// only capability lost is rendering the table of contents in our own sidebar,
// which the native viewer exposes through its own bookmarks panel.
//
// Caveat this handles: iOS Safari will not scroll a PDF inside an iframe and
// shows only the first page, so mobile gets an explicit open-in-new-tab route
// rather than a viewer that silently appears broken.
const isIOS = typeof navigator !== 'undefined'
  && (/iPad|iPhone|iPod/.test(navigator.userAgent)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1))

export default function PdfViewer({ url }) {
  const [failed, setFailed] = useState(false)

  if (isIOS || failed) {
    return (
      <div className="file-preview-content pdf-fallback">
        <p className="muted">
          {isIOS
            ? 'iOS can’t display PDFs inline reliably.'
            : 'This PDF couldn’t be displayed inline.'}
        </p>
        <a href={url} target="_blank" rel="noreferrer" className="pdf-fallback-link">
          Open PDF in a new tab
        </a>
      </div>
    )
  }

  return (
    <div className="file-preview-content">
      <iframe
        src={url}
        title="PDF preview"
        className="pdf-frame"
        onError={() => setFailed(true)}
      />
    </div>
  )
}
