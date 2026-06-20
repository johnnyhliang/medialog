import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const KEY = Deno.env.get('FINNHUB_KEY') ?? ''
const BASE = 'https://finnhub.io/api/v1'

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  let tickers: string[] = []
  try {
    const body = await req.json()
    tickers = body.tickers ?? []
  } catch { /* default empty */ }

  const [quotes, movers, trending, headlines] = await Promise.all([
    fetchQuotes(tickers),
    fetchMovers(),
    fetchTrending(),
    fetchHeadlines(),
  ])

  return new Response(JSON.stringify({ quotes, gainers: movers.gainers, losers: movers.losers, trending, headlines }), {
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
})

async function fetchQuotes(tickers: string[]) {
  const results = await Promise.allSettled(
    tickers.map(async (ticker) => {
      const r = await fetch(`${BASE}/quote?symbol=${ticker}&token=${KEY}`)
      const q = await r.json()
      if (!q || q.c == null) throw new Error('no data')
      const change = q.c - q.pc
      const changePercent = q.pc ? (change / q.pc) * 100 : 0
      return { ticker, price: q.c, change, changePercent }
    })
  )
  return results
    .filter((r): r is PromiseFulfilledResult<any> => r.status === 'fulfilled')
    .map((r) => r.value)
}

async function fetchMovers(): Promise<{ gainers: any[], losers: any[] }> {
  try {
    const [gRes, lRes] = await Promise.all([
      fetch('https://query1.finance.yahoo.com/v1/finance/screener/predefined/saved?scrIds=day_gainers&count=5'),
      fetch('https://query1.finance.yahoo.com/v1/finance/screener/predefined/saved?scrIds=day_losers&count=5'),
    ])
    const [gJson, lJson] = await Promise.all([gRes.json(), lRes.json()])
    const parse = (json: any) =>
      (json?.finance?.result?.[0]?.quotes ?? []).slice(0, 3).map((q: any) => ({
        ticker: q.symbol,
        changePercent: q.regularMarketChangePercent ?? 0,
      }))
    return { gainers: parse(gJson), losers: parse(lJson) }
  } catch {
    return { gainers: [], losers: [] }
  }
}

async function fetchTrending(): Promise<any[]> {
  try {
    const r = await fetch('https://apewisdom.io/api/v1.0/filter/all-reddit/page/1')
    const json = await r.json()
    return (json?.results ?? []).slice(0, 5).map((item: any) => {
      const prev = item.mentions_24h_ago ?? item.mentions ?? 1
      const mentionsDelta = prev ? ((item.mentions - prev) / prev) * 100 : 0
      return { ticker: item.ticker, mentions: item.mentions, mentionsDelta }
    })
  } catch {
    return []
  }
}

async function fetchHeadlines(): Promise<any[]> {
  try {
    const r = await fetch(`${BASE}/news?category=general&minId=0&token=${KEY}`)
    const json = await r.json()
    return (json ?? []).slice(0, 6).map((item: any) => ({
      title: item.headline,
      url: item.url,
      source: item.source,
    })).filter((h: any) => h.title && h.url)
  } catch {
    return []
  }
}
