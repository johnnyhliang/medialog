import { useCallback, useRef, useState } from 'react'

export default function useToast() {
  const [toasts, setToasts] = useState([])
  const timers = useRef({})

  const addToast = useCallback((message, type = 'info', options = {}) => {
    const id = crypto.randomUUID()
    const duration = options.duration ?? 4000
    setToasts((prev) => [...prev, { id, message, type, duration, actions: options.actions || [] }])
    timers.current[id] = setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
      delete timers.current[id]
      options.onExpire?.()
    }, duration)
    return id
  }, [])

  const dismissToast = useCallback((id) => {
    clearTimeout(timers.current[id])
    delete timers.current[id]
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  return { toasts, addToast, dismissToast }
}
