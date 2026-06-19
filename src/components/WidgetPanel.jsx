import ClockWidget from './widgets/ClockWidget.jsx'
import SearchWidget from './widgets/SearchWidget.jsx'
import QuickLinksWidget from './widgets/QuickLinksWidget.jsx'
import MarketNewsWidget from './widgets/MarketNewsWidget.jsx'

export default function WidgetPanel({ supabase }) {
  return (
    <div className="widget-panel">
      <ClockWidget />
      <SearchWidget />
      <QuickLinksWidget />
      <MarketNewsWidget supabase={supabase} />
    </div>
  )
}
