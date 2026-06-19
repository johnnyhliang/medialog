// src/components/widgets/ClockWidget.jsx
import { useEffect, useState } from 'react'

function formatClock(date) {
  const day = date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
  const time = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
  return `${day} · ${time}`
}

export default function ClockWidget() {
  const [display, setDisplay] = useState(() => formatClock(new Date()))

  useEffect(() => {
    const id = setInterval(() => setDisplay(formatClock(new Date())), 1000)
    return () => clearInterval(id)
  }, [])

  return <p className="widget-clock">{display}</p>
}
