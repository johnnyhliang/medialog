// DB helpers for the job-application pipeline. Same shape as the other db
// modules: requireUser where a row is being created, unwrap on every result.
//
// These five queries used to live inline in ApplicationsView, each destructuring
// only `data` or only `error`. The load path was the usual lie — `if (data)
// setApps(data)` renders a failed fetch as an empty pipeline, which for a
// tracker is indistinguishable from "you have not applied to anything", the one
// state a user would never question.

import { unwrap, unwrapList } from './unwrap.js'
import { requireUser } from '../requireUser.js'

export async function listApplications(supabase) {
  return unwrapList(await supabase
    .from('applications')
    .select('*')
    .order('updated_at', { ascending: false }), 'listApplications')
}

export async function createApplication(supabase, form) {
  // requireUser, not getUserOrNull: this runs only when someone has filled in a
  // company and a role and pressed Save. Being signed out is not an ordinary
  // outcome to skip past here — it means the thing they just typed is about to
  // be dropped.
  //
  // user_id is stamped explicitly even though migration 0044 gave the column an
  // `auth.uid()` default. The default alone works, but when there is no session
  // it resolves to null and the row is rejected by the `applications: own rows`
  // policy — surfacing as "new row violates row-level security policy", a
  // message that says nothing about signing in. Asking first turns that into a
  // NotSignedInError the caller can actually branch on.
  const user = await requireUser(supabase)
  return unwrap(await supabase
    .from('applications')
    .insert({
      ...form,
      user_id: user.id,
      // Empty date inputs arrive as '' from the form, which Postgres rejects as
      // a date. Normalising here rather than in the component keeps every
      // caller of this function safe rather than only the one that remembered.
      applied_at: form.applied_at || null,
      deadline: form.deadline || null,
    })
    .select()
    .single(), 'createApplication')
}

export async function updateApplicationStatus(supabase, id, status, updatedAt = new Date().toISOString()) {
  // `updated_at` is passed in rather than generated here so the caller's
  // optimistic row and the persisted row carry the same timestamp — otherwise
  // the list re-sorts by a value the UI never saw.
  unwrap(await supabase
    .from('applications')
    .update({ status, updated_at: updatedAt })
    .eq('id', id), 'updateApplicationStatus')
}

export async function updateApplicationNotes(supabase, id, notes) {
  unwrap(await supabase
    .from('applications')
    .update({ notes, updated_at: new Date().toISOString() })
    .eq('id', id), 'updateApplicationNotes')
}

export async function deleteApplication(supabase, id) {
  unwrap(await supabase
    .from('applications')
    .delete()
    .eq('id', id), 'deleteApplication')
}
