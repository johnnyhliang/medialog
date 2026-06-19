import { useState, useMemo } from 'react'

export function useTopics() {
  const [topics, setTopics] = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const [inboxCount, setInboxCount] = useState(0)

  const selectedTopic = useMemo(() => topics.find(t => t.id === selectedId) || null, [topics, selectedId])
  const inboxTopic = useMemo(() => topics.find(t => t.name === 'Inbox'), [topics])

  function applyAddTopic(topic) {
    setTopics(prev => [...prev, topic].sort((a, b) => a.name.localeCompare(b.name)))
    setSelectedId(topic.id)
  }

  return { topics, setTopics, selectedId, setSelectedId, inboxCount, setInboxCount, selectedTopic, inboxTopic, applyAddTopic }
}
