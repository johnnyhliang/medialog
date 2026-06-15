import { firstHeading } from '../lib/firstHeading.js'

export default function TopicTOC({ entries }) {
  const items = entries
    .map((e) => ({ id: e.id, heading: firstHeading(e.note) }))
    .filter((x) => x.heading)

  if (items.length === 0) return null

  return (
    <nav className="toc">
      <p className="section-label">Contents</p>
      <ul>
        {items.map((x) => (
          <li key={x.id}><a href={`#entry-${x.id}`}>{x.heading}</a></li>
        ))}
      </ul>
    </nav>
  )
}
