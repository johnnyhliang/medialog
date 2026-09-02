import { unwrap, unwrapList } from './unwrap.js'

// The `companies` table behind Settings -> Companies: the ATS boards the job
// poller walks. Extracted from CompaniesTab.jsx for the same reason as
// programs.js — saves happen on change, so a rejected write has no visible
// failure of its own unless the query throws one.

export async function listCompanies(supabase) {
  const result = await supabase.from('companies').select('*').order('name')
  return unwrapList(result, 'listCompanies')
}

export async function setCompanyEnabled(supabase, id, enabled) {
  const result = await supabase.from('companies').update({ enabled }).eq('id', id)
  return unwrap(result, 'setCompanyEnabled')
}

export async function deleteCompany(supabase, id) {
  const result = await supabase.from('companies').delete().eq('id', id)
  return unwrap(result, 'deleteCompany')
}

// Tags arrive from a comma-separated text input. Splitting lives here so the
// column's shape (a text[] with no empties) is defined once, next to the write,
// rather than re-derived by every caller that grows a company form.
export function parseCompanyTags(input) {
  return String(input ?? '').split(',').map((t) => t.trim()).filter(Boolean)
}

export async function createCompany(supabase, { slug, name, ats, tags }) {
  const result = await supabase
    .from('companies')
    .insert({
      slug: slug.trim(),
      name: name.trim(),
      ats,
      tags: Array.isArray(tags) ? tags : parseCompanyTags(tags),
      enabled: true,
    })
    .select()
    .single()
  return unwrap(result, 'createCompany')
}
