import { expect, test, vi } from 'vitest'
import { DEFAULT_FEATURE_FLAGS, loadFeatureFlags } from '../../../src/lib/featureFlags.js'

test('loads the public founder feature switch from app_flags', async () => {
  const inMock = vi.fn().mockResolvedValue({
    data: [{ key: 'founder_features_public', enabled: false }],
    error: null,
  })
  const select = vi.fn(() => ({ in: inMock }))
  const from = vi.fn(() => ({ select }))

  await expect(loadFeatureFlags({ from })).resolves.toEqual({ founderFeaturesPublic: false })
  expect(from).toHaveBeenCalledWith('app_flags')
  expect(select).toHaveBeenCalledWith('key, enabled')
  expect(inMock).toHaveBeenCalledWith('key', ['founder_features_public'])
})

test('falls back to build defaults when app_flags is unavailable', async () => {
  const supabase = {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        in: vi.fn().mockResolvedValue({ data: null, error: { message: 'missing table' } }),
      })),
    })),
  }

  await expect(loadFeatureFlags(supabase)).resolves.toEqual(DEFAULT_FEATURE_FLAGS)
})
