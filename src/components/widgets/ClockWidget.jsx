import { useEffect, useState } from 'react'

function formatClock(date) {
  const day = date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
  const time = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
  return { day: day.toLowerCase(), time: time.toLowerCase() }
}

export default function ClockWidget() {
  const [display, setDisplay] = useState(() => formatClock(new Date()))

  useEffect(() => {
    const id = setInterval(() => setDisplay(formatClock(new Date())), 1000)
    return () => clearInterval(id)
  }, [])

  return (
    <div className="kw-clock">
      <span className="kw-clock-time">{display.time}</span>
      <span className="kw-clock-day">{display.day}</span>
    </div>
  )
}
