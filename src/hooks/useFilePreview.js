import { useState, useCallback } from 'react'

export function useFilePreview() {
  const [previewUrl, setPreviewUrl] = useState(null)
  const openPreview = useCallback((url) => setPreviewUrl(url), [])
  const closePreview = useCallback(() => setPreviewUrl(null), [])
  return { previewUrl, openPreview, closePreview }
}
