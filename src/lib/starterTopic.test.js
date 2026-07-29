import { test, expect, vi } from 'vitest'
import { seedStarterTopic, STARTER_ENTRIES, STARTER_TOPIC_NAME } from './starterTopic.js'

const supabaseWith = (existing) => ({
  from: () => ({
    select: () => ({ eq: () => ({ limit: () => Promise.resolve({ data: existing }) }) }),
  }),
})

test('seeds the topic and every entry on an empty account', async () => {
  const createTopic = vi.fn().mockResolvedValue({ id: 't1', name: STARTER_TOPIC_NAME })
  const createEntry = vi.fn().mockResolvedValue({})

  const topic = await seedStarterTopic(supabaseWith([]), { createTopic, createEntry })

  expect(topic.id).toBe('t1')
  expect(createTopic).toHaveBeenCalledWith(expect.anything(), STARTER_TOPIC_NAME)
  expect(createEntry).toHaveBeenCalledTimes(STARTER_ENTRIES.length)
  expect(createEntry.mock.calls[0][1]).toMatchObject({ topicId: 't1' })
})

test('is a no-op when the topic already exists', async () => {
  const createTopic = vi.fn()
  const createEntry = vi.fn()

  const topic = await seedStarterTopic(supabaseWith([{ id: 't1' }]), { createTopic, createEntry })

  expect(topic).toBeNull()
  expect(createTopic).not.toHaveBeenCalled()
  expect(createEntry).not.toHaveBeenCalled()
})
