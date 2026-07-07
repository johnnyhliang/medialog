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
  { owner: 'LuisaE',       repo: 'opportunities',                 branch: 'master', file: 'README.md',         tags: ['fellowship', 'program'] },
  { owner: 'Julian048',    repo: 'CS-Everything-but-Internships', branch: 'main', file: 'README.md',         tags: ['fellowship', 'program'] },
]

// Closed-position markers used by SimplifyJobs and others
const CLOSED_RE = /🔒|closed|no longer available|\[closed\]/i

function extractLink(cell: string): string | null {
  // markdown link [text](url) …
  const md = cell.match(/\[.*?\]\((https?:\/\/[^)]+)\)/)
  if (md) return md[1]
  // … or an HTML anchor <a href="url"> (vanshb03/SimplifyJobs use image buttons)
  const html = cell.match(/href=["'](https?:\/\/[^"']+)["']/i)
  return html ? html[1] : null
}

// Convert a markdown table cell to plain text, KEEPING link text.
// `[Stripe](https://…)` → `Stripe` (the old code stripped the whole link,
// which erased company names that boards wrap in a link).
function cellText(cell: string): string {
  return cell
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1') // [text](url) → text
    .replace(/<[^>]+>/g, ' ')                // strip HTML (SimplifyJobs <details>/<br>)
    .replace(/[*_`]/g, '')                   // strip emphasis / code ticks
    .replace(/\s+/g, ' ')
    .trim()
}

function parseMarkdownTable(markdown: string, tags: string[]): Opportunity[] {
  const results: Opportunity[] = []
  const lines = markdown.split('\n')

  let inTable = false
  let headers: string[] = []
  // Some boards (northwesternfintech) put the company as a `## Heading` above a
  // bare Role|Links table rather than in a column. Track the latest heading so
  // those rows can still be attributed to a company.
  let headingCompany = ''

  for (const raw of lines) {
    const line = raw.trim()

    // Company headings (## / ###). Skip obvious section headings.
    const heading = line.match(/^#{2,3}\s+(.+)/)
    if (heading) {
      const h = cellText(heading[1])
      if (h && !/^(off[-\s]?season|table of contents|contents|internships?|new\s?grad|faq)/i.test(h)) {
        headingCompany = h
      }
      continue
    }

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

    // Prefer an explicit company column; fall back to the section heading.
    const company = cellText(companyRaw) || headingCompany
    const role = cellText(roleRaw)
    // Link can live in the apply column or be wrapped around company/role.
    const url = extractLink(linkRaw) ?? extractLink(companyRaw) ?? extractLink(roleRaw)

    if (!url || !role) continue

    // Bare role in `title`; keep `company` separate. The widget composes
    // "Company — Role", so embedding the company here double-prints it.
    const location = cellText(locationRaw) || null

    results.push({
      source: 'github',
      company: company || null,
      title: role,
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
