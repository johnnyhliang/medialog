import type { Opportunity } from './hn.ts'

type BoardConfig = {
  owner: string
  repo: string
  branch: string
  file: string
  tags: string[]
}

const BOARDS: BoardConfig[] = [
  { owner: 'SimplifyJobs', repo: 'Summer2026-Internships',        branch: 'dev', file: 'README.md',          tags: ['swe', 'internship'] },
  { owner: 'vanshb03',     repo: 'Summer2027-Internships',        branch: 'dev', file: 'README.md',          tags: ['swe', 'internship'] },
  { owner: 'vanshb03',     repo: 'Summer2027-Internships',        branch: 'dev', file: 'OFFSEASON_README.md', tags: ['swe', 'internship', 'offseason'] },
  { owner: 'SimplifyJobs', repo: 'New-Grad-Positions',            branch: 'dev', file: 'README.md',          tags: ['swe', 'new-grad'] },
  { owner: 'northwesternfintech', repo: '2026QuantInternships',   branch: 'main', file: 'README.md',         tags: ['quant', 'internship'] },
  { owner: 'northwesternfintech', repo: '2027QuantInternships',   branch: 'main', file: 'README.md',         tags: ['quant', 'internship'] },
  { owner: 'zapplyjobs',   repo: 'underclassmen-internships',     branch: 'main', file: 'README.md',         tags: ['swe', 'internship', 'underclassmen'] },
  { owner: 'LuisaE',       repo: 'opportunities',                 branch: 'main', file: 'README.md',         tags: ['fellowship', 'program'] },
  { owner: 'Julian048',    repo: 'CS-Everything-but-Internships', branch: 'main', file: 'README.md',         tags: ['fellowship', 'program'] },
]

// Closed-position markers used by SimplifyJobs and others
const CLOSED_RE = /🔒|closed|no longer available|\[closed\]/i

function extractLink(cell: string): string | null {
  const m = cell.match(/\[.*?\]\((https?:\/\/[^)]+)\)/)
  return m ? m[1] : null
}

function parseMarkdownTable(markdown: string, tags: string[]): Opportunity[] {
  const results: Opportunity[] = []
  const lines = markdown.split('\n')

  let inTable = false
  let headers: string[] = []

  for (const raw of lines) {
    const line = raw.trim()

    // Detect table header row
    if (!inTable && line.startsWith('|') && line.includes('|')) {
      const cells = line.split('|').map((c) => c.trim()).filter(Boolean)
      const lower = cells.map((c) => c.toLowerCase())
      if (lower.some((h) => h.includes('company') || h.includes('role') || h.includes('position') || h.includes('program'))) {
        headers = lower
        inTable = true
        continue
      }
    }

    // Skip separator rows (|---|---|)
    if (inTable && /^\|[-:\s|]+\|?$/.test(line)) continue

    // End of table
    if (inTable && !line.startsWith('|')) { inTable = false; headers = []; continue }

    if (!inTable) continue

    const cells = line.split('|').map((c) => c.trim()).filter(Boolean)
    if (cells.length < 2) continue

    // Skip closed rows
    if (CLOSED_RE.test(line)) continue
    // Skip sub-rows (↳ means a role variant under a closed parent in SimplifyJobs)
    if (cells[0].startsWith('↳')) continue

    const get = (keywords: string[]): string => {
      const idx = headers.findIndex((h) => keywords.some((k) => h.includes(k)))
      return idx >= 0 ? (cells[idx] ?? '') : ''
    }

    const companyRaw = get(['company', 'employer', 'organization'])
    const roleRaw = get(['role', 'position', 'title', 'program', 'name'])
    const locationRaw = get(['location'])
    const linkRaw = get(['link', 'apply', 'application', 'url'])

    const company = companyRaw.replace(/\[.*?\]\(.*?\)/g, '').replace(/[*_]/g, '').trim()
    const role = roleRaw.replace(/\[.*?\]\(.*?\)/g, '').replace(/[*_]/g, '').trim()
    const url = extractLink(linkRaw) ?? extractLink(companyRaw) ?? extractLink(roleRaw)

    if (!url || !role) continue
    // Skip if company or role cell is blank/whitespace (table section headers)
    if (!company && !role) continue

    const label = role || company
    const title = company ? `${company} — ${label}` : label
    const location = locationRaw.replace(/\[.*?\]\(.*?\)/g, '').trim() || null

    results.push({
      source: 'github',
      company: company || null,
      title,
      body: location,
      url,
      author: null,
      posted_at: new Date().toISOString(),
      tags,
    })
  }

  return results
}

async function fetchBoard(board: BoardConfig): Promise<Opportunity[]> {
  const url = `https://raw.githubusercontent.com/${board.owner}/${board.repo}/${board.branch}/${board.file}`
  try {
    const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } })
    if (!r.ok) return []
    const text = await r.text()
    return parseMarkdownTable(text, board.tags)
  } catch (e) {
    console.error(`fetchBoard error ${board.owner}/${board.repo}:`, e)
    return []
  }
}

export async function fetchGithub(): Promise<Opportunity[]> {
  const settled = await Promise.allSettled(BOARDS.map(fetchBoard))
  return settled
    .filter((r): r is PromiseFulfilledResult<Opportunity[]> => r.status === 'fulfilled')
    .flatMap((r) => r.value)
}
