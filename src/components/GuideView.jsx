import MarkdownView from './MarkdownView.jsx'
import { GUIDE_MARKDOWN } from '../lib/guideContent.js'

// Static, in-app user guide. Content lives in src/lib/guideContent.js so it's
// easy to edit in one place; rendered through the shared MarkdownView.
export default function GuideView() {
  return (
    <div className="guide-view">
      <MarkdownView className="note guide-doc">{GUIDE_MARKDOWN}</MarkdownView>
    </div>
  )
}
