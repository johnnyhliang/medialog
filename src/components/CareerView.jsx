import { useState } from 'react'
import OpportunityView from './OpportunityView.jsx'
import ApplicationsView from './ApplicationsView.jsx'
import WatchlistTab from './WatchlistTab.jsx'

const TABS = [
  { id: 'radar', label: 'Radar' },
  { id: 'watchlist', label: 'Watchlist' },
  { id: 'applications', label: 'Applications' },
]

export default function CareerView({ supabase, initialTab = 'radar', addToast }) {
  const [activeTab, setActiveTab] = useState(initialTab)
  const [trackPrefill, setTrackPrefill] = useState(null)

  function handleTrack(opportunity) {
    setTrackPrefill(opportunity)
    setActiveTab('applications')
  }

  return (
    <div className="career-view">
      <div className="career-tabs">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            className={`career-tab${activeTab === tab.id ? ' career-tab--active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="career-tab-panel">
        {activeTab === 'radar' && (
          <OpportunityView supabase={supabase} onTrack={handleTrack} />
        )}
        {activeTab === 'watchlist' && (
          <WatchlistTab supabase={supabase} />
        )}
        {activeTab === 'applications' && (
          <ApplicationsView
            supabase={supabase}
            prefill={trackPrefill}
            onClearPrefill={() => setTrackPrefill(null)}
            addToast={addToast}
          />
        )}
      </div>
    </div>
  )
}
