import { MODULES, stageOf, effectiveMinTier } from './modules.js'
import { SETTINGS_INDEX } from './settingsIndex.js'
import { GUIDE_MARKDOWN } from './guideContent.js'
import { callAI } from './ai.js'

// "How do I…" / "where is that setting" answered about the app itself, as
// opposed to askLibrarian() which answers about the user's notes.
//
// Deliberately NOT retrieval-augmented. The entire app-knowledge corpus — module
// registry, settings index, and the guide — is ~5k tokens, so it fits in a single
// prompt many times over. RAG exists to solve corpora that do NOT fit; adding
// embeddings here would cost API calls, add a table to keep in sync, and make
// answers fuzzier than simply showing the model everything.
//
// The capability map is DERIVED from the same registries the UI renders from, so
// it cannot drift: add a module or a settings entry and this updates itself.

const SYSTEM = `You help a user operate MediaLog, a personal knowledge app. Answer using ONLY the app reference below.

Rules:
- Be specific about WHERE something lives: name the exact Settings tab or sidebar item.
- If a feature is founder-only, experimental, or beta, say so plainly rather than telling the user to go find it.
- If the reference doesn't cover it, say the app doesn't appear to do that. Never invent a menu, button, or setting.
- Two or three sentences unless the user asks for steps. No preamble.`

/** Compact, always-current description of what the app can do and where. */
export function buildAppKnowledge({ isVisible = () => true } = {}) {
  const featureLines = MODULES.map((m) => {
    const stage = stageOf(m)
    const tier = effectiveMinTier(m.id)
    const marks = []
    if (m.core) marks.push('always on')
    if (stage !== 'stable') marks.push(stage)
    if (tier !== 'free') marks.push(`${tier} only`)
    if (!isVisible(m.id)) marks.push('NOT currently visible to this user')
    return `- ${m.label} (${m.id}): ${m.description}${marks.length ? ` [${marks.join('; ')}]` : ''}`
  }).join('\n')

  const settingsLines = SETTINGS_INDEX
    .filter((s) => !s.module || isVisible(s.module))
    .map((s) => `- "${s.label}" → Settings › ${s.tab}`)
    .join('\n')

  return `## Features
${featureLines}

## Where settings live
${settingsLines}

## Turning features on or off
Settings › Modules lists every optional feature with a checkbox. Turning one off hides its
sidebar entry and routes; the data is untouched and returns if switched back on. Core features
cannot be disabled. Settings also has a search box that filters across every tab.

## How the app is meant to be used
${GUIDE_MARKDOWN}`
}

/**
 * Heuristic router: is this a question about the APP, or about the user's NOTES?
 *
 * Cheap and deliberately conservative — when unsure it returns false so the
 * question falls through to library retrieval, which is the more common intent.
 */
const APP_PATTERNS = [
  /\bhow (do|can|would) i\b/i,
  /\bwhere (is|are|do|can)\b/i,
  /\bhow does (the )?(app|medialog)\b/i,
  /\b(turn|switch) (it |them )?(on|off)\b/i,
  /\b(enable|disable|hide|show) (the |a )?\w+/i,
  /\bwhat (does|is) (the )?\w+ (tab|module|setting|button|feature)\b/i,
  /\bsettings?\b.*\?/i,
  /\b(shortcut|keybind|bookmarklet|export|backup|revoke|token)\b/i,
]

export function looksLikeAppQuestion(text) {
  const q = String(text ?? '')
  return APP_PATTERNS.some((re) => re.test(q))
}

/**
 * Answer a question about operating the app.
 * Returns { answer, tabs[] } — `tabs` are settings tabs mentioned, so the UI can
 * offer to jump straight there instead of making the user hunt.
 */
export async function askAppHelp(supabase, question, { isVisible = () => true, history = [] } = {}) {
  const reference = buildAppKnowledge({ isVisible })

  const messages = [
    { role: 'system', content: `${SYSTEM}\n\n# App reference\n${reference}` },
    ...history.slice(-4),
    { role: 'user', content: question },
  ]

  const answer = await callAI(supabase, { messages })

  // Surface any settings tab the answer names, so the panel can deep-link.
  const tabs = [...new Set(
    SETTINGS_INDEX
      .filter((s) => (!s.module || isVisible(s.module))
        && new RegExp(`\\b${s.tab}\\b|${escapeRe(s.label)}`, 'i').test(answer ?? ''))
      .map((s) => s.tab)
  )]

  return { answer, tabs }
}

const escapeRe = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
