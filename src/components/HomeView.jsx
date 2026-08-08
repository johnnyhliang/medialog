// src/components/HomeView.jsx
import InboxCard from './InboxCard.jsx'
import TopicsGrid from './TopicsGrid.jsx'
import WidgetPanel from './WidgetPanel.jsx'
import HomeReviewSummary from './HomeReviewSummary.jsx'
import IndexHealthBanner from './IndexHealthBanner.jsx'
import DeadlineAlertBanner from './widgets/DeadlineAlertBanner.jsx'

export default function HomeView({ topics, inboxCount, addToast, onSelectTopic, onSortInbox, onTopicIconChange, supabase, onTrack, onSaveFeedItem, onGoToFeed, onOpenEntry, onGoToDigest, onGoToCareer, showDeadlines = false, timezone }) {
  const nonInbox = topics.filter((t) => t.name !== 'Inbox')

  return (
    <div className="home-view">
      <div className="home-left">
        {/* Renders nothing when nothing is wrong — the healthy path costs no
            attention. This is the loud half of fire-and-forget indexing. */}
        <IndexHealthBanner supabase={supabase} addToast={addToast} />
        {/* Above the review summary, because a closing window is the one thing
            here that expires. Renders nothing when nothing is close, and is
            gated on the career module — no module, no career deadlines. */}
        {showDeadlines && (
          <DeadlineAlertBanner supabase={supabase} timezone={timezone} onOpenCareer={onGoToCareer} />
        )}
        <HomeReviewSummary supabase={supabase} onSortInbox={onSortInbox} onGoToDigest={onGoToDigest} />
        <InboxCard count={inboxCount} onSortInbox={onSortInbox} />
        <p className="section-label home-topics-label">TOPICS</p>
        <TopicsGrid topics={nonInbox} onSelectTopic={onSelectTopic} onTopicIconChange={onTopicIconChange} supabase={supabase} />
      </div>
      <div className="home-right">
        <WidgetPanel supabase={supabase} onTrack={onTrack} onSaveFeedItem={onSaveFeedItem} onGoToFeed={onGoToFeed} onOpenEntry={onOpenEntry} timezone={timezone} />
      </div>
    </div>
  )
}
