// src/components/widgets/QuickLinksWidget.jsx
import { Mail, Calendar, Coffee } from 'lucide-react'

const LINKS = [
  { label: 'Gmail',    href: 'https://mail.google.com',       Icon: Mail },
  { label: 'Calendar', href: 'https://calendar.google.com',   Icon: Calendar },
  { label: 'Brew',     href: 'https://www.morningbrew.com',   Icon: Coffee },
]

export default function QuickLinksWidget() {
  return (
    <div className="widget-quicklinks">
      {LINKS.map(({ label, href, Icon }) => (
        <a key={label} href={href} target="_blank" rel="noreferrer" className="widget-quicklink-chip">
          <Icon size={14} />
          {label}
        </a>
      ))}
    </div>
  )
}
