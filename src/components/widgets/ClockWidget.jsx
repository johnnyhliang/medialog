import { useEffect, useState } from 'react'
import { browserTimezone } from '../../lib/timezone.js'

// `timeZone: undefined` is what Intl already does by default, so passing the
// resolved zone through is enough — no branch for the browser-default case.
function formatClock(date, tz) {
  const day = date.toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', timeZone: tz,
  })
  const time = date.toLocaleTimeString('en-US', {
    hour: 'numeric', minute: '2-digit', hour12: true, timeZone: tz,
  })
  return { day: day.toLowerCase(), time: time.toLowerCase() }
}

export default function ClockWidget({ timezone = browserTimezone() }) {
  const [display, setDisplay] = useState(() => formatClock(new Date(), timezone))

  useEffect(() => {
    // Re-render immediately on a timezone change rather than waiting up to a
    // second for the next tick — switching the zone in Settings should look
    // instant, not laggy.
    setDisplay(formatClock(new Date(), timezone))
    const id = setInterval(() => setDisplay(formatClock(new Date(), timezone)), 1000)
    return () => clearInterval(id)
  }, [timezone])

  return (
    <div className="kw-clock">
      <span className="kw-clock-time">{display.time}</span>
      <span className="kw-clock-day">{display.day}</span>
    </div>
  )
}
