const IG_BASE = 'https://www.instagram.com/api/v1'

const DEFAULT_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  'X-IG-App-ID': '936619743392459',
  'Accept': '*/*',
  'Accept-Language': 'en-US,en;q=0.9',
}

export interface ReelItem {
  reelUrl: string       // e.g. https://www.instagram.com/reel/SHORTCODE/
  caption: string
  mediaType: 'reel' | 'video'
}

export async function fetchInboxReels(sessionId: string): Promise<ReelItem[]> {
  const res = await fetch(
    `${IG_BASE}/direct_v2/inbox/?visual_media_check_pending=false&thread_message_limit=20`,
    {
      headers: {
        ...DEFAULT_HEADERS,
        Cookie: `sessionid=${sessionId}`,
      },
    }
  )
  if (!res.ok) throw new Error(`Instagram inbox fetch failed: ${res.status}`)
  const data = await res.json()
  const threads: unknown[] = data?.inbox?.threads ?? []
  const items: ReelItem[] = []
  for (const thread of threads) {
    const messages: unknown[] = (thread as Record<string, unknown>)?.items as unknown[] ?? []
    for (const msg of messages) {
      const m = msg as Record<string, unknown>
      // Reels come through as link items or clip items
      const link = (m.link as Record<string, unknown> | undefined)
      const clip = (m.clip as Record<string, unknown> | undefined)
      if (link?.link_context) {
        const lc = link.link_context as Record<string, unknown>
        const url = lc.link_url as string | undefined
        if (url?.includes('/reel/') || url?.includes('/p/')) {
          const mediaType = url.includes('/reel/') ? 'reel' : 'video'
          items.push({ reelUrl: url, caption: (lc.link_title as string) ?? '', mediaType })
        }
      } else if (clip) {
        const media = clip as Record<string, unknown>
        const code = media?.code as string | undefined
        const caption = ((media?.caption as Record<string, unknown>)?.text as string) ?? ''
        if (code) {
          const reelUrl = `https://www.instagram.com/reel/${code}/`
          const mediaType = reelUrl.includes('/reel/') ? 'reel' : 'video'
          items.push({ reelUrl, caption, mediaType })
        }
      }
    }
  }
  return items
}
