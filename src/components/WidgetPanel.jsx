import ClockWidget from './widgets/ClockWidget.jsx'
import SearchWidget from './widgets/SearchWidget.jsx'
import QuickLinksWidget from './widgets/QuickLinksWidget.jsx'
import MarketNewsWidget from './widgets/MarketNewsWidget.jsx'
import WeatherWidget from './widgets/WeatherWidget.jsx'
import DeadlineAlertBanner from './widgets/DeadlineAlertBanner.jsx'
import OpportunitiesWidget from './widgets/OpportunitiesWidget.jsx'

export default function WidgetPanel({ supabase, onTrack }) {
  return (
    <div className="widget-panel">
      <DeadlineAlertBanner supabase={supabase} />
      <ClockWidget />
      <WeatherWidget />
      <div className="kw-divider" />
      <SearchWidget />
      <div className="kw-divider" />
      <p className="kw-label">quick links</p>
      <QuickLinksWidget />
      <div className="kw-divider" />
      <OpportunitiesWidget supabase={supabase} onTrack={onTrack} />
      <div className="kw-divider" />
      <MarketNewsWidget supabase={supabase} />
    </div>
  )
}
