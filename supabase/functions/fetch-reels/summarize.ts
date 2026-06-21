export async function summarizeReel(caption: string, geminiKey: string): Promise<string> {
  if (!caption.trim()) return ''
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': geminiKey },
      body: JSON.stringify({
        contents: [{ parts: [{ text: `Summarize this Instagram reel caption in 1-2 sentences, focusing on the key idea or takeaway:\n\n${caption.slice(0, 2000)}` }] }],
        generationConfig: { maxOutputTokens: 150 },
      }),
    }
  )
  if (!res.ok) return caption.slice(0, 300)
  const data = await res.json()
  return data?.candidates?.[0]?.content?.parts?.[0]?.text ?? caption.slice(0, 300)
}
