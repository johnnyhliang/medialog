import { useState } from 'react'

export function useArchiveToast() {
  const [archiveToast, setArchiveToast] = useState(true)
  return { archiveToast, setArchiveToast }
}
