// The study plan: target date + which tracks you're currently aiming at.
//
// Deliberately tiny and separate from the curriculum. Pivoting is a plan change,
// never a data migration — switch focus from 'qt' to 'swe' and readiness, pace
// and suggestions all re-derive from the same untouched problems.

export const EMPTY_PLAN = { targetDate: null, focus: [] }

export async function loadStudyPlan(supabase) {
  if (!supabase) return EMPTY_PLAN
  const { data, error } = await supabase
    .from('user_configs')
    .select('prep_target_date, prep_focus')
    .maybeSingle()
  if (error || !data) return EMPTY_PLAN
  return {
    targetDate: data.prep_target_date ?? null,
    focus: Array.isArray(data.prep_focus) ? data.prep_focus : [],
  }
}

export async function saveStudyPlan(supabase, { targetDate, focus }) {
  const { data: { user } } = await supabase.auth.getUser()
  const patch = {}
  if (targetDate !== undefined) patch.prep_target_date = targetDate || null
  if (focus !== undefined) patch.prep_focus = focus ?? []
  const { error } = await supabase
    .from('user_configs')
    .update(patch)
    .eq('user_id', user.id)
  if (error) throw new Error(error.message)
}
