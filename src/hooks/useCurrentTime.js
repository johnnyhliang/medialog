import { useEffect, useState } from 'react'

/**
 * The wall clock, as state.
 *
 * Three components computed `Date.now()` straight in their render bodies to show
 * "checked 3m ago". That makes render a function of something other than props
 * and state: two renders with identical inputs produce different output, which
 * is exactly what memoization and concurrent rendering are allowed to assume
 * cannot happen. Reading the clock in an interval and holding it in state moves
 * the impurity into an effect, where it belongs.
 *
 * The interval is a real tradeoff, not a default — this hook re-renders its
 * component every `intervalMs` forever, whether or not anything changed. 60s is
 * the deliberate choice for every current caller because all of them display
 * whole minutes: ticking faster repaints identical pixels, and ticking slower
 * would let a visible "2m ago" sit stale for longer than the unit it claims to
 * measure. A caller that renders seconds should pass 1000 and accept the cost;
 * one that renders days should pass something far larger.
 */
export default function useCurrentTime(intervalMs = 60000) {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs)
    return () => clearInterval(id)
  }, [intervalMs])

  return now
}

/** Whole minutes between `then` (a Date or null) and a clock reading. */
export function minutesSince(then, now) {
  if (!then) return null
  return Math.max(0, Math.floor((now - then.getTime()) / 60000))
}
