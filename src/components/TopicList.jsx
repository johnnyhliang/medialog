import { useState } from 'react'
import { Inbox, ChevronDown, ChevronRight } from 'lucide-react'

export default function TopicList({
  topics,
  activeTopics,
  archivedTopics,
  selectedId,
  onSelect,
  onAdd,
  sidebarCollapsed,
}) {
  const [name, setName] = useState('')
  const [archiveSectionOpen, setArchiveSectionOpen] = useState(() => {
    try { return localStorage.getItem('medialog_archive_section_open') === 'true' } catch { return false }
  })

  const allTopics = topics ?? []
  const allActive = activeTopics ?? allTopics.filter(t => !t.archived_at)
  const allArchived = archivedTopics ?? allTopics.filter(t => t.archived_at)
  const inboxTopic = allActive.find(t => t.name === 'Inbox')
  const activeNonInbox = allActive
    .filter(t => t.name !== 'Inbox')
    .sort((a, b) => a.name.localeCompare(b.name))

  function toggleArchiveSection() {
    const next = !archiveSectionOpen
    setArchiveSectionOpen(next)
    try { localStorage.setItem('medialog_archive_section_open', next) } catch {}
  }

  function handleAdd(e) {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return
    onAdd(trimmed)
    setName('')
  }

  return (
    <nav>
      <p className="section-label">Topics</p>
      <ul className="topics">
        {inboxTopic && (
          <li key={inboxTopic.id}>
            <button
              className={inboxTopic.id === selectedId ? 'selected topic-inbox-btn' : 'topic-inbox-btn'}
              onClick={() => onSelect(inboxTopic.id)}
              title="Inbox"
            >
              <Inbox size={14} className="topic-inbox-icon" />
              {!sidebarCollapsed && <span>{inboxTopic.name}</span>}
              {sidebarCollapsed && <span>{inboxTopic.name.slice(0, 2).toUpperCase()}</span>}
            </button>
          </li>
        )}
        {inboxTopic && activeNonInbox.length > 0 && <li><hr className="topic-divider" /></li>}

        {activeNonInbox.map((t) => (
          <li key={t.id}>
            <button
              className={t.id === selectedId ? 'selected' : ''}
              onClick={() => onSelect(t.id)}
              title={t.name}
            >
              {sidebarCollapsed ? t.name.slice(0, 2).toUpperCase() : t.name}
            </button>
          </li>
        ))}
      </ul>

      <form className="topic-add" onSubmit={handleAdd}>
        <input
          placeholder="new topic"
          maxLength={120}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <button type="submit">Add</button>
      </form>

      {allArchived.length > 0 && (
        <>
          <button className="topics-archived-toggle" onClick={toggleArchiveSection}>
            {archiveSectionOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            {!sidebarCollapsed && 'Archived'}
          </button>
          {archiveSectionOpen && (
            <ul className="topics-archived-list">
              {[...allArchived].sort((a, b) => a.name.localeCompare(b.name)).map((t) => (
                <li key={t.id}>
                  <button
                    className={`topic-archived-btn${t.id === selectedId ? ' selected' : ''}`}
                    onClick={() => onSelect(t.id)}
                    title={t.name}
                  >
                    {sidebarCollapsed ? t.name.slice(0, 2).toUpperCase() : t.name}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </nav>
  )
}
