// Captures the GitHub OAuth code out of the URL before supabaseClient.js is
// constructed or AuthGate can redirect.
//
// Kept first for readability, but the ordering no longer DEPENDS on it: this
// used to rely on side-effect imports evaluating in source order, which the
// bundler does not preserve — Rollup inlined this module into the app chunk
// while leaving supabaseClient a separate static import, and a statically
// imported module is fully evaluated before the importing module's body, so
// createClient actually ran first. supabaseClient.js now imports the flag from
// this module, which puts the guarantee in the dependency graph where a
// bundler must respect it.
import './lib/captureOAuthCode.js'
import React from 'react'
import ReactDOM from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import App from './App.jsx'
import './styles.css'

// Keep the installed app fresh. With registerType 'autoUpdate' a new deploy is
// applied and the page reloaded automatically once the new SW is detected; the
// hourly r.update() makes long-open tabs notice new deploys without a manual
// hard-refresh.
registerSW({
  immediate: true,
  onRegisteredSW(_swUrl, r) {
    if (r) setInterval(() => r.update(), 60 * 60 * 1000)
  },
})

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
