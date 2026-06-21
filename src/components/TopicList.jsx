import { useState, useRef, useEffect } from 'react'
import { Inbox, MoreVertical, ChevronDown, ChevronRight } from 'lucide-react'
import ConfirmModal from './ConfirmModal.jsx'

export default function TopicList({
  topics,
  activeTopics,
  archivedTopics,
  selectedId,
  onSelect,
  onAdd,
  sidebarCollapsed,
  onArchive,
  onUnarchive,
  onDeleteTopic,
}) {
  const [name, setName] = useState('')
  const [openMenuId, setOpenMenuId] = useState(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState(null)
  const [archiveSectionOpen, setArchiveSectionOpen] = useState(() => {
    try { return localStorage.getItem('medialog_archive_section_open') === 'true' } catch { return false }
  })
  const menuRef = useRef(null)

  const allTopics = topics ?? []
  const allActive = activeTopics ?? allTopics.filter(t => !t.archived_at)
  const allArchived = archivedTopics ?? allTopics.filter(t => t.archived_at)
  const inboxTopic = allActive.find(t => t.name === 'Inbox')
  const activeNonInbox = allActive
    .filter(t => t.name !== 'Inbox')
    .sort((a, b) => a.name.localeCompare(b.name))

  useEffect(() => {
    function handleClick(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) setOpenMenuId(null)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

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
          <li key={t.id} className="topic-item" ref={openMenuId === t.id ? menuRef : null}>
            <button
              className={t.id === selectedId ? 'selected' : ''}
              onClick={() => onSelect(t.id)}
              title={t.name}
            >
              {sidebarCollapsed ? t.name.slice(0, 2).toUpperCase() : t.name}
            </button>
            {!sidebarCollapsed && (
              <button
                className="topic-menu-btn"
                aria-label="topic menu"
                onClick={(e) => { e.stopPropagation(); setOpenMenuId(openMenuId === t.id ? null : t.id) }}
              >
                <MoreVertical size={12} />
              </button>
            )}
            {openMenuId === t.id && (
              <div className="topic-menu-popover">
                <button className="topic-menu-item" onClick={() => { onArchive?.(t.id); setOpenMenuId(null) }}>
                  Archive
                </button>
                <button className="topic-menu-item danger" onClick={() => { setConfirmDeleteId(t.id); setOpenMenuId(null) }}>
                  Delete
                </button>
              </div>
            )}
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
                <li key={t.id} className="topic-item" ref={openMenuId === t.id ? menuRef : null}>
                  <button
                    className={`topic-archived-btn${t.id === selectedId ? ' selected' : ''}`}
                    onClick={() => onSelect(t.id)}
                    title={t.name}
                  >
                    {sidebarCollapsed ? t.name.slice(0, 2).toUpperCase() : t.name}
                  </button>
                  {!sidebarCollapsed && (
                    <button
                      className="topic-menu-btn"
                      aria-label="topic menu"
                      onClick={(e) => { e.stopPropagation(); setOpenMenuId(openMenuId === t.id ? null : t.id) }}
                    >
                      <MoreVertical size={12} />
                    </button>
                  )}
                  {openMenuId === t.id && (
                    <div className="topic-menu-popover">
                      <button className="topic-menu-item" onClick={() => { onUnarchive?.(t.id); setOpenMenuId(null) }}>
                        Unarchive
                      </button>
                      <button className="topic-menu-item danger" onClick={() => { setConfirmDeleteId(t.id); setOpenMenuId(null) }}>
                        Delete
                      </button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </>
      )}
      {confirmDeleteId && (
        <ConfirmModal
          message="Permanently delete this topic and move all its entries to trash?"
          confirmLabel="Delete"
          onConfirm={() => { onDeleteTopic?.(confirmDeleteId); setConfirmDeleteId(null) }}
          onCancel={() => setConfirmDeleteId(null)}
        />
      )}
    </nav>
  )
}
