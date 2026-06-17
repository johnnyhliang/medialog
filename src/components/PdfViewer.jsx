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
      if (!canvasRef.current) return

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
    return () => {
      cancelled = true
      renderTaskRef.current?.cancel()
    }
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
