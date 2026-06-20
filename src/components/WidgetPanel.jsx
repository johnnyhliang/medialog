import ClockWidget from './widgets/ClockWidget.jsx'
import SearchWidget from './widgets/SearchWidget.jsx'
import QuickLinksWidget from './widgets/QuickLinksWidget.jsx'
import MarketNewsWidget from './widgets/MarketNewsWidget.jsx'

export default function WidgetPanel({ supabase }) {
  return (
    <div className="widget-panel">
      <ClockWidget />
      <div className="kw-divider" />
      <SearchWidget />
      <div className="kw-divider" />
      <p className="kw-label">quick links</p>
      <QuickLinksWidget />
      <div className="kw-divider" />
      <MarketNewsWidget supabase={supabase} />
    </div>
  )
}
