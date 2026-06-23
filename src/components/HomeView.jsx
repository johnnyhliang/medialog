// src/components/HomeView.jsx
import InboxCard from './InboxCard.jsx'
import TopicsGrid from './TopicsGrid.jsx'
import WidgetPanel from './WidgetPanel.jsx'
import HomeReviewSummary from './HomeReviewSummary.jsx'

export default function HomeView({ topics, inboxCount, onSelectTopic, onSortInbox, onTopicIconChange, supabase, onTrack, onSaveFeedItem, onGoToFeed, onOpenEntry, onGoToDigest }) {
  const nonInbox = topics.filter((t) => t.name !== 'Inbox')

  return (
    <div className="home-view">
      <div className="home-left">
        <HomeReviewSummary supabase={supabase} onSortInbox={onSortInbox} onGoToDigest={onGoToDigest} />
        <InboxCard count={inboxCount} onSortInbox={onSortInbox} />
        <p className="section-label home-topics-label">TOPICS</p>
        <TopicsGrid topics={nonInbox} onSelectTopic={onSelectTopic} onTopicIconChange={onTopicIconChange} supabase={supabase} />
      </div>
      <div className="home-right">
        <WidgetPanel supabase={supabase} onTrack={onTrack} onSaveFeedItem={onSaveFeedItem} onGoToFeed={onGoToFeed} onOpenEntry={onOpenEntry} />
      </div>
    </div>
  )
}
