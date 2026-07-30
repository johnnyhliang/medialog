// Subscription status → tier. Pure, provider-shaped but provider-agnostic.
//
// This is the piece worth getting right before real money exists, because both
// failure directions are bad in ways that are hard to notice: granting paid to a
// lapsed account loses revenue quietly, and revoking it from a paying customer
// loses the customer. Isolated here so it is fully unit-testable with no
// provider, no network, and no database.
//
// Statuses are Stripe's vocabulary (the likely provider) but nothing else in the
// file depends on Stripe. Swapping providers means extending the status map.

export const TIER_FREE = 'free'
export const TIER_PAID = 'paid'

// Days of continued access after a failed payment. Dunning retries take roughly a
// week, and yanking access on the first failed charge punishes an expired card
// rather than a non-paying user — the most common reason a good customer goes
// past_due.
export const GRACE_DAYS = 7

// Statuses that mean "currently entitled", independent of dates.
const ACTIVE_STATUSES = new Set(['active', 'trialing'])
// Failed payment, retries in progress: entitled during the grace window only.
const GRACE_STATUSES = new Set(['past_due'])
// Everything else — canceled, unpaid, incomplete, incomplete_expired, paused —
// falls through to free. Listing them is documentation, not logic: the default
// must be free so an unrecognized status can never grant access.
export const KNOWN_STATUSES = new Set([
  ...ACTIVE_STATUSES, ...GRACE_STATUSES,
  'canceled', 'unpaid', 'incomplete', 'incomplete_expired', 'paused',
])

/**
 * Resolve a tier from a subscription row.
 *
 * @param sub  subscriptions row, or null/undefined when the user has none
 * @param now  injected clock
 */
export function tierFromSubscription(sub, now = Date.now()) {
  if (!sub?.status) return TIER_FREE

  const periodEnd = sub.current_period_end ? new Date(sub.current_period_end).getTime() : null

  if (ACTIVE_STATUSES.has(sub.status)) {
    // cancel_at_period_end keeps access until the period actually ends — they
    // paid for it. Only a period end in the past revokes.
    if (periodEnd != null && periodEnd < now) return TIER_FREE
    return TIER_PAID
  }

  if (GRACE_STATUSES.has(sub.status)) {
    // No period end means we can't bound the grace window; refuse rather than
    // grant indefinitely.
    if (periodEnd == null) return TIER_FREE
    return now <= periodEnd + GRACE_DAYS * 86400000 ? TIER_PAID : TIER_FREE
  }

  return TIER_FREE
}

/**
 * Human-readable billing state for the UI. Separate from the tier because what
 * someone is *entitled to* and what they should be *told* differ: a past_due
 * user still has access but needs to hear about it.
 */
export function billingState(sub, now = Date.now()) {
  const tier = tierFromSubscription(sub, now)
  if (!sub?.status) return { tier, label: 'Free', needsAttention: false, status: 'none' }

  const periodEnd = sub.current_period_end ? new Date(sub.current_period_end).getTime() : null

  if (sub.status === 'past_due') {
    return {
      tier, status: sub.status, needsAttention: true,
      label: tier === TIER_PAID ? 'Payment failed — access ends soon' : 'Payment failed',
    }
  }
  if (ACTIVE_STATUSES.has(sub.status) && sub.cancel_at_period_end) {
    return { tier, status: sub.status, needsAttention: true, label: 'Cancels at period end' }
  }
  if (sub.status === 'trialing') {
    return { tier, status: sub.status, needsAttention: false, label: 'Trial' }
  }
  if (ACTIVE_STATUSES.has(sub.status)) {
    const lapsed = periodEnd != null && periodEnd < now
    return {
      tier, status: sub.status, needsAttention: lapsed,
      label: lapsed ? 'Expired' : 'Paid',
    }
  }
  return { tier, status: sub.status, needsAttention: false, label: 'Free' }
}

/**
 * Normalizes a provider webhook payload into a subscriptions row.
 *
 * Kept pure so webhook handling is testable without a provider: the edge
 * function's only job becomes verify-signature → this → sync_tier_from_billing.
 * Returns null for payloads that carry no subscription, so unrelated events are
 * ignored rather than writing a half-empty row.
 */
export function subscriptionFromWebhook(event) {
  const obj = event?.data?.object
  if (!obj || !obj.id || !obj.status) return null
  const userId = obj.metadata?.user_id ?? event?.data?.object?.client_reference_id ?? null
  if (!userId) return null

  return {
    user_id: userId,
    provider: 'stripe',
    provider_customer_id: obj.customer ?? null,
    provider_subscription_id: obj.id,
    status: obj.status,
    price_id: obj.items?.data?.[0]?.price?.id ?? null,
    cancel_at_period_end: Boolean(obj.cancel_at_period_end),
    current_period_end: obj.current_period_end
      ? new Date(obj.current_period_end * 1000).toISOString()
      : null,
  }
}
