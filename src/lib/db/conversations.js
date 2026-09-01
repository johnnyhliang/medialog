// Persistence for the "Ask your library" assistant. Conversations and their
// messages are owner-scoped (RLS in migration 0049); user_id is filled by the
// column default (auth.uid()) so the client never sets it — which is why no
// function here calls requireUser: there is no user.id to interpolate, and RLS
// is the thing enforcing ownership.

import { unwrap, unwrapList } from './unwrap.js'

const TITLE_MAX = 80

// Derive a thread title from the first user question.
export function titleFromQuestion(q) {
  const clean = String(q ?? '').trim().replace(/\s+/g, ' ')
  if (!clean) return 'New chat'
  return clean.length > TITLE_MAX ? `${clean.slice(0, TITLE_MAX).trimEnd()}…` : clean
}

export async function listConversations(supabase) {
  return unwrapList(await supabase
    .from('assistant_conversations')
    .select('id, title, updated_at')
    .order('updated_at', { ascending: false }), 'listConversations')
}

export async function createConversation(supabase, title = 'New chat') {
  return unwrap(await supabase
    .from('assistant_conversations')
    .insert({ title })
    .select('id, title, updated_at')
    .single(), 'createConversation')
}

export async function renameConversation(supabase, id, title) {
  unwrap(await supabase
    .from('assistant_conversations')
    .update({ title, updated_at: new Date().toISOString() })
    .eq('id', id), 'renameConversation')
}

export async function touchConversation(supabase, id) {
  unwrap(await supabase
    .from('assistant_conversations')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', id), 'touchConversation')
}

export async function deleteConversation(supabase, id) {
  unwrap(await supabase.from('assistant_conversations').delete().eq('id', id), 'deleteConversation')
}

export async function listMessages(supabase, conversationId) {
  return unwrapList(await supabase
    .from('assistant_messages')
    .select('id, role, content, sources')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true }), 'listMessages')
}

export async function addMessage(supabase, conversationId, { role, content, sources = [] }) {
  return unwrap(await supabase
    .from('assistant_messages')
    .insert({ conversation_id: conversationId, role, content, sources })
    .select('id, role, content, sources')
    .single(), 'addMessage')
}
