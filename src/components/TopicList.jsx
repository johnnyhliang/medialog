import { useState } from 'react'
import { Inbox, ChevronDown, ChevronRight, Pin, PinOff } from 'lucide-react'

export default function TopicList({
  topics,
  activeTopics,
  archivedTopics,
  selectedId,
  onSelect,
  onAdd,
  onPinToggle,
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
  const nonInbox = allActive.filter(t => t.name !== 'Inbox')
  const pinnedTopics = nonInbox.filter(t => t.pinned).sort((a, b) => a.name.localeCompare(b.name))
  const regularTopics = nonInbox.filter(t => !t.pinned).sort((a, b) => a.name.localeCompare(b.name))

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

  function TopicBtn({ t }) {
    return (
      <li key={t.id}>
        <div className="topic-row">
          <button
            className={`topic-row-btn${t.id === selectedId ? ' selected' : ''}${t.pinned ? ' topic-row-btn--pinned' : ''}`}
            onClick={() => onSelect(t.id)}
            title={t.name}
          >
            {t.pinned && !sidebarCollapsed && <Pin size={9} className="topic-pin-indicator" />}
            {sidebarCollapsed ? t.name.slice(0, 2).toUpperCase() : t.name}
          </button>
          {!sidebarCollapsed && onPinToggle && (
            <button
              className="topic-pin-btn"
              onClick={(e) => { e.stopPropagation(); onPinToggle(t.id, !t.pinned) }}
              title={t.pinned ? 'Unpin' : 'Pin to top'}
              aria-label={t.pinned ? `Unpin ${t.name}` : `Pin ${t.name} to top`}
            >
              {t.pinned ? <PinOff size={11} /> : <Pin size={11} />}
            </button>
          )}
        </div>
      </li>
    )
  }

  return (
    <nav>
      <p className="section-label">Topics</p>

      {/* Compact switcher for narrow screens — the full list below is hidden
          via CSS at the same breakpoint so topics don't eat the whole drawer. */}
      <select
        className="topics-dropdown"
        value={selectedId ?? ''}
        onChange={(e) => e.target.value && onSelect(e.target.value)}
        aria-label="Jump to topic"
      >
        <option value="" disabled>Jump to topic…</option>
        {inboxTopic && <option value={inboxTopic.id}>{inboxTopic.name}</option>}
        {pinnedTopics.length > 0 && (
          <optgroup label="Pinned">
            {pinnedTopics.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </optgroup>
        )}
        {regularTopics.length > 0 && (
          <optgroup label="Topics">
            {regularTopics.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </optgroup>
        )}
        {allArchived.length > 0 && (
          <optgroup label="Archived">
            {[...allArchived].sort((a, b) => a.name.localeCompare(b.name)).map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </optgroup>
        )}
      </select>

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

        {pinnedTopics.length > 0 && (
          <>
            {inboxTopic && <li><hr className="topic-divider" /></li>}
            {pinnedTopics.map((t) => <TopicBtn key={t.id} t={t} />)}
          </>
        )}

        {regularTopics.length > 0 && (
          <>
            <li><hr className="topic-divider" /></li>
            {regularTopics.map((t) => <TopicBtn key={t.id} t={t} />)}
          </>
        )}

        {pinnedTopics.length === 0 && regularTopics.length === 0 && inboxTopic && null}
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
