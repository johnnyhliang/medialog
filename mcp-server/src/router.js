import { bulkCreateEntriesAction, bulkMoveEntriesAction, createEntryAction, createTopicAction, moveEntryAction } from './operations/write.js'
import { dashboardOverview, listEntriesForTopic, listInbox, listForRevisitView, listTopicsView, recentActivity, searchGlobal, topicProgress, trashList } from './operations/read.js'
import { normalizeLimit } from './helpers.js'
import { tools } from './tools.js'

export function createRouter(supabase) {
  return {
    tools,
    async call(name, args) {
      switch (name) {
        case 'list_topics':
          return { content: payload(await listTopicsView(supabase, args)) }
        case 'list_entries_by_topic':
          return { content: payload(await listEntriesForTopic(supabase, args)) }
        case 'search_entries':
          return { content: payload(await searchGlobal(supabase, args)) }
        case 'list_inbox':
          return { content: payload(await listInbox(supabase, normalizeLimit(args.limit, 200, 500))) }
        case 'get_dashboard_overview':
          return { content: payload(await dashboardOverview(supabase, args)) }
        case 'get_topic_progress':
          return { content: payload(await topicProgress(supabase, args)) }
        case 'list_revisit_queue':
          return { content: payload(await listForRevisitView(supabase, normalizeLimit(args.limit, 10, 50))) }
        case 'list_recent_activity':
          return { content: payload(await recentActivity(supabase, normalizeLimit(args.limit, 30, 100))) }
        case 'list_trash':
          return { content: payload(await trashList(supabase, normalizeLimit(args.limit, 200, 500))) }
        case 'create_topic':
          return { content: payload(await createTopicAction(supabase, args)) }
        case 'create_entry':
          return { content: payload(await createEntryAction(supabase, args)) }
        case 'bulk_create_entries':
          return { content: payload(await bulkCreateEntriesAction(supabase, args)) }
        case 'move_entry':
          return { content: payload(await moveEntryAction(supabase, args)) }
        case 'bulk_move_entries':
          return { content: payload(await bulkMoveEntriesAction(supabase, args)) }
        default:
          throw new Error(`Unknown tool: ${name}`)
      }
    },
  }
}

function payload(data) {
  return [{
    type: 'text',
    text: JSON.stringify(data, null, 2),
  }]
}
