import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import LinkEmbed, { isPdfUrl } from './LinkEmbed.jsx'
import { getYouTubeId } from '../lib/youtube.js'

function isParagraphOnlyLink(node) {
  if (!node?.children || node.children.length !== 1) return null
  const child = node.children[0]
  if (child.type !== 'element' || child.tagName !== 'a') return null
  const href = child.properties?.href
  return typeof href === 'string' ? href : null
}

function shouldEmbedLink(href) {
  if (!href || href.startsWith('#')) return false
  if (getYouTubeId(href) || isPdfUrl(href)) return true
  try {
    const u = new URL(href)
    return u.protocol === 'http:' || u.protocol === 'https:'
  } catch {
    return false
  }
}

export function buildMarkdownComponents() {
  return {
    a: ({ href, children, ...props }) => {
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

const mdComponents = buildMarkdownComponents()

export default function MarkdownView({ children, className = 'note' }) {
  return (
    <div className={className}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>
        {children}
      </ReactMarkdown>
    </div>
  )
}
