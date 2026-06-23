import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient.js'

const STORAGE_KEY = 'ml_theme'
const VALID_PALETTES = ['warm', 'catppuccin-mocha', 'tokyo-night', 'nord', 'rose-pine']
const VALID_STYLES = ['default', 'brutalist', 'glass']
const DEFAULT = { palette: 'warm', style: 'default' }

function readLocal() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY))
    if (VALID_PALETTES.includes(parsed?.palette) && VALID_STYLES.includes(parsed?.style))
      return parsed
  } catch {}
  return null
}

function applyToHtml(palette, style) {
  document.documentElement.dataset.theme = palette
  document.documentElement.dataset.style = style
}

function writeLocal(palette, style) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ palette, style }))
}

async function syncToDb(palette, style) {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    await supabase
      .from('user_configs')
      .update({ theme: { palette, style } })
      .eq('user_id', user.id)
  } catch {}
}

export function useTheme() {
  const [theme, setThemeState] = useState(() => {
    const t = readLocal() ?? DEFAULT
    applyToHtml(t.palette, t.style)
    return t
  })

  useEffect(() => {
    async function syncFromDb() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase
        .from('user_configs')
        .select('theme')
        .eq('user_id', user.id)
        .maybeSingle()
      const db = data?.theme
      if (!db || !VALID_PALETTES.includes(db.palette) || !VALID_STYLES.includes(db.style)) return
      const local = readLocal()
      if (local?.palette !== db.palette || local?.style !== db.style) {
        applyToHtml(db.palette, db.style)
        writeLocal(db.palette, db.style)
        setThemeState({ palette: db.palette, style: db.style })
      }
    }
    syncFromDb()
  }, [])

  function setPalette(p) {
    if (!VALID_PALETTES.includes(p)) return
    setThemeState(prev => {
      const next = { palette: p, style: prev.style }
      applyToHtml(next.palette, next.style)
      writeLocal(next.palette, next.style)
      syncToDb(next.palette, next.style)
      return next
    })
  }

  function setStyle(s) {
    if (!VALID_STYLES.includes(s)) return
    setThemeState(prev => {
      const next = { palette: prev.palette, style: s }
      applyToHtml(next.palette, next.style)
      writeLocal(next.palette, next.style)
      syncToDb(next.palette, next.style)
      return next
    })
  }

  return { palette: theme.palette, style: theme.style, setPalette, setStyle }
}
