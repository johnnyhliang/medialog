import { ExternalLink, Star, Code2, LayoutDashboard } from 'lucide-react'

// Curated external job boards. The GitHub lists are the community-maintained
// repos that get updated multiple times a day during recruiting season; the
// dashboard row links out to the standalone ApplyKit app.

const SECTIONS = [
  {
    label: 'Dashboard',
    icon: LayoutDashboard,
    links: [
      { name: 'ApplyKit dashboard', url: 'https://applykit-gray.vercel.app/', note: 'your standalone application tracker' },
    ],
  },
  {
    label: 'Internships (auto-updated GitHub lists)',
    icon: Code2,
    links: [
      { name: 'Simplify · Summer 2026 Internships', url: 'https://github.com/SimplifyJobs/Summer2026-Internships', note: 'the canonical list' },
      { name: 'vanshb03 · Summer 2026 Internships', url: 'https://github.com/vanshb03/Summer2026-Internships', note: 'fast mirror + extras' },
      { name: 'Ouckah · Summer 2026 Internships', url: 'https://github.com/Ouckah/Summer2026-Internships' },
      { name: 'speedyapply · SWE internships', url: 'https://github.com/speedyapply/2025-SWE-College-Jobs', note: 'with salaries' },
      { name: 'Northwestern FinTech · Quant internships', url: 'https://github.com/northwesternfintech/2026QuantInternships', note: 'quant / trading' },
    ],
  },
  {
    label: 'New grad (auto-updated GitHub lists)',
    icon: Code2,
    links: [
      { name: 'Simplify · New Grad Positions', url: 'https://github.com/SimplifyJobs/New-Grad-Positions' },
      { name: 'speedyapply · New grad SWE', url: 'https://github.com/speedyapply/2025-New-Grad-Positions', note: 'with salaries' },
      { name: 'jobright-ai · New Grad SWE', url: 'https://github.com/jobright-ai/2025-Software-Engineer-New-Grad' },
    ],
  },
  {
    label: 'Tools',
    icon: Star,
    links: [
      { name: 'Simplify.jobs', url: 'https://simplify.jobs/', note: 'autofill applications' },
      { name: 'Levels.fyi', url: 'https://www.levels.fyi/', note: 'comp data' },
    ],
  },
]

export default function BoardsTab() {
  return (
    <div className="boards-tab">
      <p className="boards-intro muted">
        Live external job boards. The GitHub lists refresh throughout the day during recruiting season —
        open one, then track anything you apply to under Applications.
      </p>
      {SECTIONS.map((section) => {
        const Icon = section.icon
        return (
          <div key={section.label} className="boards-section">
            <div className="boards-section-label">
              <Icon size={13} /> {section.label}
            </div>
            <div className="boards-links">
              {section.links.map((link) => (
                <a
                  key={link.url}
                  className="boards-link"
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <span className="boards-link-name">{link.name}</span>
                  {link.note && <span className="boards-link-note">{link.note}</span>}
                  <ExternalLink size={13} className="boards-link-icon" />
                </a>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
