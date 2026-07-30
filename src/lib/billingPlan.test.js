import { test, expect, describe } from 'vitest'
import {
  tierFromSubscription, billingState, subscriptionFromWebhook,
  GRACE_DAYS, TIER_FREE, TIER_PAID,
} from './billingPlan.js'

const NOW = new Date('2026-07-29T12:00:00Z').getTime()
const daysFromNow = (d) => new Date(NOW + d * 86400000).toISOString()
const sub = (over = {}) => ({
  status: 'active', current_period_end: daysFromNow(10),
  cancel_at_period_end: false, ...over,
})

describe('tierFromSubscription', () => {
  test('no subscription is free', () => {
    expect(tierFromSubscription(null, NOW)).toBe(TIER_FREE)
    expect(tierFromSubscription({}, NOW)).toBe(TIER_FREE)
    expect(tierFromSubscription({ status: null }, NOW)).toBe(TIER_FREE)
  })

  test('active and trialing are paid', () => {
    expect(tierFromSubscription(sub(), NOW)).toBe(TIER_PAID)
    expect(tierFromSubscription(sub({ status: 'trialing' }), NOW)).toBe(TIER_PAID)
  })

  test('cancel_at_period_end keeps access until the period actually ends', () => {
    expect(tierFromSubscription(sub({ cancel_at_period_end: true }), NOW)).toBe(TIER_PAID)
    expect(tierFromSubscription(
      sub({ cancel_at_period_end: true, current_period_end: daysFromNow(-1) }), NOW
    )).toBe(TIER_FREE)
  })

  test('past_due keeps access through the grace window, then stops', () => {
    const end = daysFromNow(-1)
    expect(tierFromSubscription({ status: 'past_due', current_period_end: end }, NOW)).toBe(TIER_PAID)
    const longPast = daysFromNow(-(GRACE_DAYS + 2))
    expect(tierFromSubscription({ status: 'past_due', current_period_end: longPast }, NOW)).toBe(TIER_FREE)
  })

  test('past_due with no period end refuses rather than granting indefinitely', () => {
    expect(tierFromSubscription({ status: 'past_due', current_period_end: null }, NOW)).toBe(TIER_FREE)
  })

  test('terminal statuses are free', () => {
    for (const status of ['canceled', 'unpaid', 'incomplete', 'incomplete_expired', 'paused']) {
      expect(tierFromSubscription(sub({ status }), NOW)).toBe(TIER_FREE)
    }
  })

  // The security-relevant default: a status we've never seen must not grant paid.
  test('an unrecognized status defaults to free', () => {
    expect(tierFromSubscription(sub({ status: 'some_new_stripe_status' }), NOW)).toBe(TIER_FREE)
  })
})

describe('billingState', () => {
  test('past_due still has access but is flagged for attention', () => {
    const s = billingState({ status: 'past_due', current_period_end: daysFromNow(-1) }, NOW)
    expect(s.tier).toBe(TIER_PAID)
    expect(s.needsAttention).toBe(true)
  })

  test('a pending cancellation is surfaced without losing access', () => {
    const s = billingState(sub({ cancel_at_period_end: true }), NOW)
    expect(s.tier).toBe(TIER_PAID)
    expect(s.needsAttention).toBe(true)
    expect(s.label).toMatch(/cancels/i)
  })

  test('healthy paid and trial states need no attention', () => {
    expect(billingState(sub(), NOW).needsAttention).toBe(false)
    expect(billingState(sub({ status: 'trialing' }), NOW).label).toBe('Trial')
  })

  test('no subscription reads as Free', () => {
    expect(billingState(null, NOW)).toMatchObject({ tier: TIER_FREE, label: 'Free', status: 'none' })
  })
})

describe('subscriptionFromWebhook', () => {
  const event = (obj) => ({ data: { object: obj } })

  test('maps a provider payload into a row', () => {
    const row = subscriptionFromWebhook(event({
      id: 'sub_123', status: 'active', customer: 'cus_9',
      metadata: { user_id: 'u1' },
      cancel_at_period_end: false,
      current_period_end: Math.floor(NOW / 1000),
      items: { data: [{ price: { id: 'price_x' } }] },
    }))
    expect(row).toMatchObject({
      user_id: 'u1', provider_subscription_id: 'sub_123',
      status: 'active', price_id: 'price_x', provider_customer_id: 'cus_9',
    })
    expect(row.current_period_end).toBe(new Date(Math.floor(NOW / 1000) * 1000).toISOString())
  })

  // Ignoring rather than writing a half-empty row: a subscription row with no
  // user is unattributable and would sync a tier to nobody.
  test('ignores payloads with no user or no subscription', () => {
    expect(subscriptionFromWebhook(event({ id: 'sub_1', status: 'active' }))).toBeNull()
    expect(subscriptionFromWebhook(event({ metadata: { user_id: 'u1' } }))).toBeNull()
    expect(subscriptionFromWebhook({})).toBeNull()
    expect(subscriptionFromWebhook(null)).toBeNull()
  })

  test('falls back to client_reference_id when metadata has no user', () => {
    const row = subscriptionFromWebhook({
      data: { object: { id: 'sub_2', status: 'active', client_reference_id: 'u2' } },
    })
    expect(row.user_id).toBe('u2')
  })
})
