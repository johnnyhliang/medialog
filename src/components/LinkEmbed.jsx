import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient.js'
import { fetchLinkPreview } from '../lib/enrich.js'
import { getYouTubeId } from '../lib/youtube.js'

export function isPdfUrl(url) {
  if (!url) return false
  try {
    const path = new URL(url).pathname.toLowerCase()
    return path.endsWith('.pdf')
  } catch {
    return url.toLowerCase().includes('.pdf')
  }
}

function YouTubeEmbed({ url }) {
  const id = getYouTubeId(url)
  if (!id) return null
  return (
    <div className="embed embed-youtube">
      <iframe
        src={`https://www.youtube-nocookie.com/embed/${id}`}
        title="YouTube video"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
      />
    </div>
  )
}

function PdfEmbed({ url, title }) {
  return (
    <div className="embed embed-pdf">
      <object data={url} type="application/pdf" title={title || 'PDF'}>
        <a href={url} target="_blank" rel="noreferrer">{title || 'Open PDF'}</a>
      </object>
    </div>
  )
}

export default function LinkEmbed({ url }) {
  const yt = getYouTubeId(url)
  const [meta, setMeta] = useState(null)

  useEffect(() => {
    if (yt || isPdfUrl(url)) return
    let cancelled = false
    fetchLinkPreview(supabase, url).then((data) => {
      if (!cancelled) setMeta(data)
    })
    return () => { cancelled = true }
  }, [url, yt])

  if (yt) return <YouTubeEmbed url={url} />
  if (isPdfUrl(url)) return <PdfEmbed url={url} title={meta?.title} />

  const title = meta?.title || url
  const site = meta?.site || ''
  const image = meta?.image

  return (
    <a className="link-embed" href={url} target="_blank" rel="noreferrer">
      {image && (
        <img
          className="link-embed-image"
          src={image}
          alt=""
          loading="lazy"
          onError={(e) => { e.target.style.display = 'none' }}
        />
      )}
      <span className="link-embed-body">
        <span className="link-embed-title">{title}</span>
        {meta?.description && <span className="link-embed-desc">{meta.description}</span>}
        {site && <span className="link-embed-site">{site}</span>}
      </span>
    </a>
  )
}
