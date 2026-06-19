// src/components/widgets/MarketNewsWidget.jsx
import { useEffect, useRef, useState } from 'react'

const TICKERS = ['VOO', 'NVDA', 'AMZN', 'AVGO', 'MA', 'V', 'SPGI']
const POLL_MS = 300_000

export default function MarketNewsWidget({ supabase }) {
  const [data, setData]   = useState(null)
  const [error, setError] = useState(false)
  const [updatedAt, setUpdatedAt] = useState(null)
  const intervalRef = useRef(null)

  async function load() {
    const { data: result, error: err } = await supabase.functions.invoke('market', {
      body: { tickers: TICKERS },
    })
    if (err || !result) { setError(true); return }
    setData(result)
    setError(false)
    setUpdatedAt(new Date())
  }

  useEffect(() => {
    load()
    intervalRef.current = setInterval(load, POLL_MS)
    return () => clearInterval(intervalRef.current)
  }, [])

  if (error) return <p className="widget-market-error muted">Market data unavailable</p>
  if (!data)  return <p className="widget-market-loading muted">Loading…</p>

  const minutesAgo = updatedAt
    ? Math.floor((Date.now() - updatedAt.getTime()) / 60000)
    : 0

  return (
    <div className="widget-market">
      {/* Market section */}
      <p className="widget-section-label">MARKET</p>
      <table className="widget-market-table">
        <tbody>
          {data.quotes?.map((q) => (
            <tr key={q.ticker}>
              <td className="market-ticker">{q.ticker}</td>
              <td className="market-price">${q.price.toFixed(2)}</td>
              <td className={`market-change ${q.changePercent >= 0 ? 'up' : 'down'}`}>
                {q.changePercent >= 0 ? '+' : ''}{q.changePercent.toFixed(2)}%
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Movers section */}
      <p className="widget-section-label">MOVERS TODAY</p>
      <div className="widget-movers">
        {data.gainers?.slice(0, 3).map((m) => (
          <span key={m.ticker} className="mover up">↑ {m.ticker} +{m.changePercent.toFixed(1)}%</span>
        ))}
        {data.losers?.slice(0, 3).map((m) => (
          <span key={m.ticker} className="mover down">↓ {m.ticker} {m.changePercent.toFixed(1)}%</span>
        ))}
      </div>

      {/* Trending section */}
      <p className="widget-section-label">TRENDING (WSB)</p>
      <ol className="widget-trending">
        {data.trending?.map((t) => (
          <li key={t.ticker}>
            <span className="trend-ticker">{t.ticker}</span>
            <span className="trend-mentions">{t.mentions.toLocaleString()}</span>
            <span className={`trend-delta ${t.mentionsDelta >= 0 ? 'up' : 'down'}`}>
              {t.mentionsDelta >= 0 ? '↑' : '↓'}{Math.abs(t.mentionsDelta).toFixed(0)}%
            </span>
          </li>
        ))}
      </ol>

      {/* Headlines section */}
      <p className="widget-section-label">HEADLINES</p>
      <ul className="widget-headlines">
        {data.headlines?.map((h) => (
          <li key={h.url}>
            <a href={h.url} target="_blank" rel="noreferrer">{h.title}</a>
          </li>
        ))}
      </ul>

      <p className="widget-updated muted">Updated {minutesAgo}m ago</p>
    </div>
  )
}
