const LINKS = [
  { label: 'gmail',    href: 'https://mail.google.com' },
  { label: 'calendar', href: 'https://calendar.google.com' },
  { label: 'morning brew', href: 'https://www.morningbrew.com' },
]

export default function QuickLinksWidget() {
  return (
    <div className="kw-rows">
      {LINKS.map(({ label, href }) => (
        <a key={label} href={href} target="_blank" rel="noreferrer" className="kw-link-row">
          <span className="kw-dot">•</span>
          <span>{label}</span>
        </a>
      ))}
    </div>
  )
}
