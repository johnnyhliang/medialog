import { useState, useMemo } from 'react'

export function useTopics() {
  const [topics, setTopics] = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const [inboxCount, setInboxCount] = useState(0)

  const selectedTopic = useMemo(() => topics.find(t => t.id === selectedId) || null, [topics, selectedId])
  const inboxTopic = useMemo(() => topics.find(t => t.name === 'Inbox'), [topics])
  const activeTopics = useMemo(() => topics.filter(t => t.name === 'Inbox' || !t.archived_at), [topics])
  const archivedTopics = useMemo(() => topics.filter(t => t.name !== 'Inbox' && t.archived_at), [topics])

  function applyAddTopic(topic) {
    setTopics(prev => [...prev, topic].sort((a, b) => a.name.localeCompare(b.name)))
    setSelectedId(topic.id)
  }

  function applyArchiveTopic(id, updated) {
    setTopics(prev => prev.map(t => t.id === id ? updated : t))
  }

  function applyUnarchiveTopic(id, updated) {
    setTopics(prev => prev.map(t => t.id === id ? updated : t))
  }

  function applyDeleteTopic(id) {
    setTopics(prev => prev.filter(t => t.id !== id))
  }

  function applyRestoreDeletedTopic(topic) {
    setTopics(prev => [...prev, topic].sort((a, b) => a.name.localeCompare(b.name)))
  }

  return {
    topics, setTopics,
    activeTopics, archivedTopics,
    selectedId, setSelectedId,
    inboxCount, setInboxCount,
    selectedTopic, inboxTopic,
    applyAddTopic,
    applyArchiveTopic, applyUnarchiveTopic,
    applyDeleteTopic, applyRestoreDeletedTopic,
  }
}
