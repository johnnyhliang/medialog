import { useEffect } from 'react'

// Escape-to-dismiss, shared by every overlay that can be closed with a keypress
// (Modal, FilePreviewModal, CatchOverlay). Each had its own identical copy of
// this effect, and each was one forgotten cleanup away from leaking a listener
// that keeps firing onClose after the overlay is gone.
//
// The listener goes on `window`, not `document`. Both see the same bubbled
// keydown — nothing in the app stops propagation between the two — but binding
// them all to one target means overlays close in a predictable order when more
// than one is mounted, rather than depending on which target each chose.
//
// `enabled` exists for overlays that stay mounted while closed (CatchOverlay
// renders null but its effects still run); when false we bind nothing at all,
// so a hidden overlay can't swallow an Escape meant for something behind it.
export function useEscapeKey(onEscape, enabled = true) {
  useEffect(() => {
    if (!enabled) return
    function onKey(e) {
      if (e.key === 'Escape') onEscape()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // Re-binds when onEscape changes so we never call a stale closure.
  }, [onEscape, enabled])
}

export default useEscapeKey
