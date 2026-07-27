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
