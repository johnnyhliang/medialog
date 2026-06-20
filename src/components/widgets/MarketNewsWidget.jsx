import { useEffect, useRef, useState } from 'react'

const TICKERS = ['VOO', 'NVDA', 'AMZN', 'AVGO', 'MA', 'V', 'SPGI']
const POLL_MS = 300_000

export default function MarketNewsWidget({ supabase }) {
  const [data, setData] = useState(null)
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

  if (error) return <p className="kw-empty">market data unavailable</p>
  if (!data)  return <p className="kw-empty">loading…</p>

  const minutesAgo = updatedAt ? Math.floor((Date.now() - updatedAt.getTime()) / 60000) : 0

  return (
    <div className="kw-market">
      <p className="kw-label">market</p>
      <div className="kw-rows">
        {data.quotes?.map((q) => (
          <div key={q.ticker} className="kw-market-row">
            <span className="kw-ticker">{q.ticker}</span>
            <span className="kw-price">${q.price.toFixed(2)}</span>
            <span className={`kw-pct ${q.changePercent >= 0 ? 'up' : 'down'}`}>
              {q.changePercent >= 0 ? '+' : ''}{q.changePercent.toFixed(2)}%
            </span>
          </div>
        ))}
      </div>

      {(data.gainers?.length > 0 || data.losers?.length > 0) && <>
        <p className="kw-label" style={{ marginTop: 20 }}>movers today</p>
        <div className="kw-rows">
          {data.gainers?.map((m) => (
            <div key={m.ticker} className="kw-mover-row">
              <span className="kw-mover-arrow up">↑</span>
              <span className="kw-ticker">{m.ticker}</span>
              <span className="kw-pct up">+{m.changePercent.toFixed(1)}%</span>
            </div>
          ))}
          {data.losers?.map((m) => (
            <div key={m.ticker} className="kw-mover-row">
              <span className="kw-mover-arrow down">↓</span>
              <span className="kw-ticker">{m.ticker}</span>
              <span className="kw-pct down">{m.changePercent.toFixed(1)}%</span>
            </div>
          ))}
        </div>
      </>}

      {data.trending?.length > 0 && <>
        <p className="kw-label" style={{ marginTop: 20 }}>trending (wsb)</p>
        <div className="kw-rows">
          {data.trending.map((t, i) => (
            <div key={t.ticker} className="kw-trend-row">
              <span className="kw-trend-rank">{i + 1}</span>
              <span className="kw-ticker">{t.ticker}</span>
              <span className="kw-mentions">{t.mentions.toLocaleString()} mentions</span>
              <span className={`kw-pct ${t.mentionsDelta >= 0 ? 'up' : 'down'}`}>
                {t.mentionsDelta >= 0 ? '↑' : '↓'}{Math.abs(t.mentionsDelta).toFixed(0)}%
              </span>
            </div>
          ))}
        </div>
      </>}

      {data.headlines?.length > 0 && <>
        <p className="kw-label" style={{ marginTop: 20 }}>headlines</p>
        <div className="kw-rows">
          {data.headlines.map((h) => (
            <a key={h.url} href={h.url} target="_blank" rel="noreferrer" className="kw-headline-row">
              <span className="kw-dot">•</span>
              <span className="kw-headline-text">{h.title}</span>
            </a>
          ))}
        </div>
      </>}

      <p className="kw-updated">updated {minutesAgo}m ago</p>
    </div>
  )
}
