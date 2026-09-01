// The single place a Supabase result turns into either data or a throw.
//
// The problem this replaces is not missing error handling — it is error
// handling that lies. Roughly 40 call sites destructure only `data` and return
// `data ?? []`, which reads like defensive programming and is the opposite of
// it: a failed query and an empty table become the same value. "Something is
// broken" is silently rewritten as "there is nothing here", which is a wrong
// answer delivered with confidence. Nobody can report that bug and nobody can
// debug it.
//
// WHY THROW RATHER THAN RETURN A RESULT OBJECT
//
// REFACTOR.md §4.4 says to decide once whether errors bubble or components
// render an error state, and claims the mess exists because the decision was
// never made. That is not quite right — the decision WAS made, and is already
// the majority convention: `captureTokens.js`, `contributions.js`,
// `conversations.js` and `entries.js` all do `if (error) throw
// new Error(error.message)`, and their callers catch and toast. What is missing
// is consistency, not a decision. So this follows the existing convention
// rather than introducing a second one, which would leave the codebase with two
// competing error models instead of one.

/**
 * A database failure that knows which operation produced it.
 *
 * `message` is deliberately the raw cause message and nothing else, so every
 * existing `catch (e) { addToast(e.message, 'error') }` keeps showing exactly
 * what it shows today. Prefixing the context into `message` would have leaked
 * internal function names into user-facing toasts across the whole app — a
 * visible regression in exchange for debuggability that belongs in the log, not
 * on screen. The context lives on the instance and in `stack` instead.
 */
export class DbError extends Error {
  constructor(context, cause) {
    super(cause?.message ?? 'Unknown database error')
    this.name = 'DbError'
    this.context = context
    // Postgres/PostgREST code, when there is one. `PGRST116` (no rows) and
    // `23505` (unique violation) are the two a caller is most likely to branch
    // on, and losing them was part of why failures got flattened to "empty".
    this.code = cause?.code
    this.details = cause?.details
    this.hint = cause?.hint
    // Not `cause: cause` via the options bag, because that requires ES2022
    // Error options support in every runtime this ships to, including the Deno
    // edge functions if this module is ever shared.
    this.cause = cause
    this.stack = `${this.name}(${context}): ${this.message}\n${this.stack ?? ''}`
  }
}

/**
 * Take a `{ data, error }` from Supabase and return the data, or throw.
 *
 * @param {{data: any, error: any}} result the awaited Supabase response
 * @param {string} context what was being attempted, for the log — e.g.
 *   'listEntriesByTopic'. Required: an error without one is the thing that
 *   makes a stack trace useless in a bundled app where names are mangled.
 */
export function unwrap(result, context) {
  if (!context) throw new Error('unwrap() requires a context string')
  if (result?.error) throw new DbError(context, result.error)
  return result?.data
}

/**
 * Same, for list queries: guarantees an array so callers can map without a
 * guard, WITHOUT the `?? []` that hides failures. The difference matters —
 * here the empty array can only mean "the query succeeded and matched nothing",
 * because any error has already thrown by the time this returns.
 */
export function unwrapList(result, context) {
  return unwrap(result, context) ?? []
}
