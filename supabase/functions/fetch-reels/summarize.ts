export async function summarizeReel(caption: string, anthropicKey: string): Promise<string> {
  if (!caption.trim()) return ''
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': anthropicKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 150,
      messages: [{
        role: 'user',
        content: `Summarize this Instagram reel caption in 1-2 sentences, focusing on the key idea or takeaway:\n\n${caption.slice(0, 2000)}`,
      }],
    }),
  })
  if (!res.ok) return caption.slice(0, 300)
  const data = await res.json()
  return data?.content?.[0]?.text ?? caption.slice(0, 300)
}
