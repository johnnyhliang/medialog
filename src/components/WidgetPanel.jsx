import ClockWidget from './widgets/ClockWidget.jsx'
import SearchWidget from './widgets/SearchWidget.jsx'
import QuickLinksWidget from './widgets/QuickLinksWidget.jsx'
import MarketNewsWidget from './widgets/MarketNewsWidget.jsx'
import WeatherWidget from './widgets/WeatherWidget.jsx'
import DeadlineAlertBanner from './widgets/DeadlineAlertBanner.jsx'
import OpportunitiesWidget from './widgets/OpportunitiesWidget.jsx'
import FeedWidget from './widgets/FeedWidget.jsx'
import FocusWidget from './widgets/FocusWidget.jsx'
import ResurfaceWidget from './widgets/ResurfaceWidget.jsx'

export default function WidgetPanel({ supabase, onTrack, onSaveFeedItem, onGoToFeed, onOpenEntry }) {
  return (
    <div className="widget-panel">
      <DeadlineAlertBanner supabase={supabase} />
      <ClockWidget />
      <WeatherWidget />
      <div className="kw-divider" />
      <FocusWidget supabase={supabase} onOpenEntry={onOpenEntry} />
      <div className="kw-divider" />
      <ResurfaceWidget supabase={supabase} onOpenEntry={onOpenEntry} />
      <SearchWidget />
      <div className="kw-divider" />
      <p className="kw-label">quick links</p>
      <QuickLinksWidget />
      <div className="kw-divider" />
      <FeedWidget supabase={supabase} onSave={onSaveFeedItem} onGoToFeed={onGoToFeed} />
      <div className="kw-divider" />
      <OpportunitiesWidget supabase={supabase} onTrack={onTrack} />
      <div className="kw-divider" />
      <MarketNewsWidget supabase={supabase} />
    </div>
  )
}
