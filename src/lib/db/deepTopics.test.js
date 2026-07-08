import { describe, test, expect } from 'vitest'
import { mockSupabase } from '../../test/mockSupabase.js'
import {
  createDeepTopic, listDeepTopics, addSection, setCursor,
  setSectionStatus, addTakeaway, updateTakeaway,
} from './deepTopics.js'

// mockSupabase resolves auth.getUser via a stub we add per test.
function withUser(result) {
  const sb = mockSupabase(result)
  sb.auth = { getUser: async () => ({ data: { user: { id: 'u1' } } }) }
  return sb
}

describe('deepTopics db', () => {
  test('createDeepTopic inserts kind=deep with source', async () => {
    const row = { id: 't1', name: 'Trading & Exchanges', kind: 'deep' }
    const sb = withUser({ data: row, error: null })
    const out = await createDeepTopic(sb, { name: 'Trading & Exchanges', source_kind: 'book' })
    expect(sb.from).toHaveBeenCalledWith('topics')
    expect(sb._chain.insert).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: 'u1', name: 'Trading & Exchanges', kind: 'deep', source_kind: 'book', source_url: null }),
    )
    expect(out).toEqual(row)
  })

  test('listDeepTopics filters kind=deep and non-deleted', async () => {
    const sb = mockSupabase({ data: [{ id: 't1', kind: 'deep' }], error: null })
    const out = await listDeepTopics(sb)
    expect(sb._chain.eq).toHaveBeenCalledWith('kind', 'deep')
    expect(sb._chain.is).toHaveBeenCalledWith('deleted_at', null)
    expect(out).toHaveLength(1)
  })

  test('addSection inserts at the given position', async () => {
    const row = { id: 's1', title: 'Ch.1', position: 3 }
    const sb = withUser({ data: row, error: null })
    const out = await addSection(sb, { topicId: 't1', title: 'Ch.1', position: 3 })
    expect(sb.from).toHaveBeenCalledWith('resource_sections')
    expect(sb._chain.insert).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: 'u1', topic_id: 't1', title: 'Ch.1', position: 3 }),
    )
    expect(out).toEqual(row)
  })

  test('setCursor updates the topic', async () => {
    const sb = mockSupabase({ data: null, error: null })
    await setCursor(sb, 't1', 's2')
    expect(sb.from).toHaveBeenCalledWith('topics')
    expect(sb._chain.update).toHaveBeenCalledWith({ cursor_section_id: 's2' })
    expect(sb._chain.eq).toHaveBeenCalledWith('id', 't1')
  })

  test('setSectionStatus updates the section', async () => {
    const sb = mockSupabase({ data: null, error: null })
    await setSectionStatus(sb, 's1', 'done')
    expect(sb._chain.update).toHaveBeenCalledWith({ status: 'done' })
    expect(sb._chain.eq).toHaveBeenCalledWith('id', 's1')
  })

  test('addTakeaway inserts an entry with takeaway + section', async () => {
    const row = { id: 'e1', takeaway: 'spread = adverse-selection comp' }
    const sb = withUser({ data: row, error: null })
    const out = await addTakeaway(sb, { topicId: 't1', sectionId: 's1', takeaway: 'spread = adverse-selection comp', note: 'p.42' })
    expect(sb.from).toHaveBeenCalledWith('entries')
    expect(sb._chain.insert).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: 'u1', topic_id: 't1', section_id: 's1', takeaway: 'spread = adverse-selection comp', note: 'p.42', parent_id: null }),
    )
    expect(out).toEqual(row)
  })

  test('addTakeaway carries parentId for a tangent', async () => {
    const sb = withUser({ data: { id: 'e2' }, error: null })
    await addTakeaway(sb, { topicId: 't1', sectionId: 's1', takeaway: 'x', parentId: 'e1' })
    expect(sb._chain.insert).toHaveBeenCalledWith(expect.objectContaining({ parent_id: 'e1' }))
  })

  test('updateTakeaway patches the entry', async () => {
    const sb = mockSupabase({ data: null, error: null })
    await updateTakeaway(sb, 'e1', { takeaway: 'edited' })
    expect(sb._chain.update).toHaveBeenCalledWith({ takeaway: 'edited' })
    expect(sb._chain.eq).toHaveBeenCalledWith('id', 'e1')
  })
})
