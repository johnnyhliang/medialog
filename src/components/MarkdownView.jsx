import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import LinkEmbed, { isPdfUrl } from './LinkEmbed.jsx'
import EntryEmbed from './EntryEmbed.jsx'
import { getYouTubeId } from '../lib/youtube.js'
import { classifyUrl } from '../lib/classifyUrl.js'
import { expandEmbedSyntax } from '../lib/embeds.js'

function isParagraphOnlyLink(node) {
  if (!node?.children || node.children.length !== 1) return null
  const child = node.children[0]
  if (child.type !== 'element' || child.tagName !== 'a') return null
  const href = child.properties?.href
  return typeof href === 'string' ? href : null
}

function shouldEmbedLink(href) {
  if (!href || href.startsWith('#') || href.startsWith('entry:')) return false
  if (getYouTubeId(href) || isPdfUrl(href)) return true
  try {
    const u = new URL(href)
    return u.protocol === 'http:' || u.protocol === 'https:'
  } catch {
    return false
  }
}

export function buildMarkdownComponents({ onPreview, getEntry, onJump } = {}) {
  const FILE_ICONS = { pdf: '📄', image: '🖼', text: '📝', drive: '🔗' }
  return {
    a: ({ href, children, ...props }) => {
      if (href && href.startsWith('entry:') && getEntry) {
        const id = href.slice('entry:'.length)
        return <EntryEmbed entryId={id} label={children} getEntry={getEntry} onJump={onJump || (() => {})} />
      }
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
      <img className="note-image" src={src} alt={alt ?? ''} loading="lazy" {...props} />
    ),
  }
}

function urlTransform(url) {
  if (url && url.startsWith('entry:')) return url
  // Default react-markdown sanitization for other URLs
  try {
    const u = new URL(url)
    if (['http:', 'https:', 'mailto:', 'tel:', 'ftp:'].includes(u.protocol)) return url
  } catch {
    // relative URLs
    if (!url.startsWith('javascript:')) return url
  }
  return ''
}

export default function MarkdownView({ children, className = 'note', onPreview, getEntry, onJump }) {
  const source = getEntry
    ? expandEmbedSyntax(String(children ?? ''), (id) => getEntry(id)?.title || null)
    : String(children ?? '')
  const components = buildMarkdownComponents({ onPreview, getEntry, onJump })
  return (
    <div className={className}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components} urlTransform={urlTransform}>
        {source}
      </ReactMarkdown>
    </div>
  )
}
