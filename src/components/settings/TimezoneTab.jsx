import { useMemo } from 'react'
import { BROWSER_DEFAULT, browserTimezone, zonedParts } from '../../lib/timezone.js'

// A curated list rather than the full IANA set. `Intl.supportedValuesOf`
// returns ~430 zones, most of which are historical aliases (`US/Eastern`,
// `Etc/GMT+7`) that no one should be picking from a dropdown. The browser
// default covers almost everyone; this list covers "I moved" and "my team is
// elsewhere", and anything missing is one line to add.
const COMMON_ZONES = [
  'Pacific/Honolulu',
  'America/Anchorage',
  'America/Los_Angeles',
  'America/Denver',
  'America/Chicago',
  'America/New_York',
  'America/Sao_Paulo',
  'UTC',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Europe/Athens',
  'Africa/Lagos',
  'Africa/Johannesburg',
  'Asia/Dubai',
  'Asia/Kolkata',
  'Asia/Singapore',
  'Asia/Shanghai',
  'Asia/Tokyo',
  'Asia/Seoul',
  'Australia/Sydney',
  'Pacific/Auckland',
]

function currentTimeIn(tz) {
  try {
    return new Date().toLocaleTimeString('en-US', {
      hour: 'numeric', minute: '2-digit', hour12: true, timeZone: tz,
    }).toLowerCase()
  } catch {
    return ''
  }
}

export default function TimezoneTab({ preference, timezone, onChange }) {
  const detected = browserTimezone()

  // The browser's own zone may not be in the curated list — someone in
  // Asia/Kathmandu should still see their zone as an explicit option rather
  // than an unexplained absence.
  const zones = useMemo(() => {
    const set = new Set(COMMON_ZONES)
    set.add(detected)
    if (preference !== BROWSER_DEFAULT) set.add(preference)
    return [...set].sort()
  }, [detected, preference])

  return (
    <div className="settings-section">
      <h3>Timezone</h3>
      <p className="settings-hint">
        Used for the clock and for deciding what counts as today, this week and
        overdue on your reminders.
      </p>

      <label className="settings-row">
        <span>Timezone</span>
        <select value={preference} onChange={(e) => onChange(e.target.value)}>
          {/* The default is a real, selectable option rather than an empty
              value, so "follow my browser" stays a choice you can return to
              after overriding it. */}
          <option value={BROWSER_DEFAULT}>Browser default — {detected}</option>
          {zones.map((tz) => (
            <option key={tz} value={tz}>
              {tz.replace(/_/g, ' ')}
            </option>
          ))}
        </select>
      </label>

      <p className="settings-hint">
        {preference === BROWSER_DEFAULT
          ? `Following this device. It currently reads ${detected}, and will change
             automatically if you open MediaLog somewhere else.`
          : `Fixed to ${timezone.replace(/_/g, ' ')}. This device reports
             ${detected}, and MediaLog will ignore that until you switch back to
             Browser default.`}
      </p>

      <p className="settings-hint">
        It is <strong>{currentTimeIn(timezone)}</strong> there, and the day ends
        in {hoursUntilEndOfDay(timezone)}.
      </p>
    </div>
  )
}

// Concrete feedback that the setting did something. A zone name is abstract;
// "the day ends in 3 hours" is the thing that actually moves a reminder between
// Today and Overdue, so showing it makes the consequence visible before it
// surprises anyone.
function hoursUntilEndOfDay(tz) {
  try {
    const p = zonedParts(new Date(), tz)
    const minutesLeft = (23 - p.hour) * 60 + (60 - p.minute)
    if (minutesLeft < 60) return `${minutesLeft} minutes`
    const hours = Math.round(minutesLeft / 60)
    return hours === 1 ? '1 hour' : `${hours} hours`
  } catch {
    return 'a while'
  }
}
