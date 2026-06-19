import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  let tickers: string[] = []
  try {
    const body = await req.json()
    tickers = body.tickers ?? []
  } catch { /* default empty */ }

  const [quotes, { gainers, losers }, trending, headlines] = await Promise.all([
    fetchQuotes(tickers),
    fetchMovers(),
    fetchTrending(),
    fetchHeadlines(),
  ])

  return new Response(JSON.stringify({ quotes, gainers, losers, trending, headlines }), {
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
})

async function fetchQuotes(tickers: string[]) {
  const results = await Promise.allSettled(
    tickers.map(async (ticker) => {
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d&range=1d`
      const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } })
      const json = await r.json()
      const meta = json?.chart?.result?.[0]?.meta
      if (!meta) throw new Error('no meta')
      const price = meta.regularMarketPrice ?? 0
      const prevClose = meta.chartPreviousClose ?? meta.previousClose ?? price
      const change = price - prevClose
      const changePercent = prevClose ? (change / prevClose) * 100 : 0
      return { ticker, price, change, changePercent }
    })
  )
  return results
    .filter((r): r is PromiseFulfilledResult<any> => r.status === 'fulfilled')
    .map((r) => r.value)
}

async function fetchMovers(): Promise<{ gainers: any[]; losers: any[] }> {
  try {
    const [gRes, lRes] = await Promise.all([
      fetch('https://query1.finance.yahoo.com/v1/finance/screener/predefined/saved?scrIds=day_gainers&count=5', {
        headers: { 'User-Agent': 'Mozilla/5.0' },
      }),
      fetch('https://query1.finance.yahoo.com/v1/finance/screener/predefined/saved?scrIds=day_losers&count=5', {
        headers: { 'User-Agent': 'Mozilla/5.0' },
      }),
    ])
    const gJson = await gRes.json()
    const lJson = await lRes.json()
    const extract = (json: any) =>
      (json?.finance?.result?.[0]?.quotes ?? []).map((q: any) => ({
        ticker: q.symbol,
        changePercent: q.regularMarketChangePercent ?? 0,
      }))
    return { gainers: extract(gJson), losers: extract(lJson) }
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
    const r = await fetch('https://feeds.reuters.com/reuters/businessNews', {
      headers: { 'User-Agent': 'Mozilla/5.0' },
    })
    const xml = await r.text()
    const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].slice(0, 5)
    return items.map((m) => {
      const titleMatch = m[1].match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/) ||
                         m[1].match(/<title>(.*?)<\/title>/)
      const linkMatch  = m[1].match(/<link>(.*?)<\/link>/)
      return {
        title: titleMatch?.[1]?.trim() ?? '',
        url:   linkMatch?.[1]?.trim() ?? '',
      }
    }).filter((h) => h.title)
  } catch {
    return []
  }
}
