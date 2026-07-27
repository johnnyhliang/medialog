export const DEFAULT_FEATURE_FLAGS = {
  founderFeaturesPublic: import.meta.env.VITE_FOUNDER_FEATURES_PUBLIC !== 'false',
}

const FLAG_KEYS = ['founder_features_public']

export async function loadFeatureFlags(supabase) {
  if (!supabase) return DEFAULT_FEATURE_FLAGS

  const { data, error } = await supabase
    .from('app_flags')
    .select('key, enabled')
    .in('key', FLAG_KEYS)

  if (error || !Array.isArray(data)) return DEFAULT_FEATURE_FLAGS

  const byKey = new Map(data.map((row) => [row.key, row.enabled]))
  return {
    founderFeaturesPublic: byKey.get('founder_features_public') ?? DEFAULT_FEATURE_FLAGS.founderFeaturesPublic,
  }
}
