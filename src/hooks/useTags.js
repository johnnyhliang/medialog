import { useState, useMemo } from 'react'

export function useTags() {
  const [allTags, setAllTags] = useState([])

  const tagColors = useMemo(
    () => Object.fromEntries(allTags.filter(t => t.color).map(t => [t.name, t.color])),
    [allTags]
  )

  function applyUpdateTagColor(name, color) {
    setAllTags(prev => prev.map(t => t.name === name ? { ...t, color: color || null } : t))
  }

  return { allTags, setAllTags, tagColors, applyUpdateTagColor }
}
