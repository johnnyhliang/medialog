export const tools = [
  {
    name: 'list_topics',
    description: 'List all topics with entry counts.',
    inputSchema: {
      type: 'object',
      properties: {
        include_inbox: { type: 'boolean', default: true },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'list_entries_by_topic',
    description: 'List entries for a topic, newest first, as summaries with a note preview. Paginated — a large topic holds hundreds of entries. Use get_entry for the full note of one.',
    inputSchema: {
      type: 'object',
      properties: {
        topic_id: { type: 'string' },
        topic_name: { type: 'string' },
        limit: { type: 'integer', minimum: 1, maximum: 200, default: 50 },
        offset: { type: 'integer', minimum: 0, default: 0 },
      },
      anyOf: [{ required: ['topic_id'] }, { required: ['topic_name'] }],
      additionalProperties: false,
    },
  },
  {
    name: 'get_entry',
    description: 'Full content of a single entry, including the complete note. Every list view returns truncated previews; this is how to read the rest.',
    inputSchema: {
      type: 'object',
      properties: { entry_id: { type: 'string' } },
      required: ['entry_id'],
      additionalProperties: false,
    },
  },
  {
    name: 'search_entries',
    description: 'Perform a global text search across non-deleted entries.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string' },
        limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
      },
      required: ['query'],
      additionalProperties: false,
    },
  },
  {
    name: 'list_inbox',
    description: 'List the current Inbox entries for triage and sorting.',
    inputSchema: {
      type: 'object',
      properties: {
        limit: { type: 'integer', minimum: 1, maximum: 500, default: 200 },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'get_dashboard_overview',
    description: 'Return a safe read-only overview of the dashboard: inbox count, topic counts, revisit queue, and recent activity.',
    inputSchema: {
      type: 'object',
      properties: {
        revisit_limit: { type: 'integer', minimum: 1, maximum: 20, default: 10 },
        activity_limit: { type: 'integer', minimum: 1, maximum: 50, default: 10 },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'get_topic_progress',
    description: 'Summarize a topic by status counts, plus a small entry sample.',
    inputSchema: {
      type: 'object',
      properties: {
        topic_id: { type: 'string' },
        topic_name: { type: 'string' },
      },
      anyOf: [{ required: ['topic_id'] }, { required: ['topic_name'] }],
      additionalProperties: false,
    },
  },
  {
    name: 'list_revisit_queue',
    description: 'List the entries scheduled to resurface next.',
    inputSchema: {
      type: 'object',
      properties: {
        limit: { type: 'integer', minimum: 1, maximum: 50, default: 10 },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'list_recent_activity',
    description: 'List recently edited entries with their topic names.',
    inputSchema: {
      type: 'object',
      properties: {
        limit: { type: 'integer', minimum: 1, maximum: 100, default: 30 },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'list_trash',
    description: 'List soft-deleted entries in Trash without changing anything.',
    inputSchema: {
      type: 'object',
      properties: {
        limit: { type: 'integer', minimum: 1, maximum: 500, default: 200 },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'list_agenda',
    description: 'List every dated, unfinished entry grouped into overdue / today / week / later. This is the backlog view — run it at the weekly review to see what is due across all commitments.',
    inputSchema: {
      type: 'object',
      properties: {
        bucket: {
          type: 'string',
          enum: ['overdue', 'today', 'week', 'later'],
          description: 'Return only one bucket instead of all four.',
        },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'whats_next',
    description: 'The morning call: at most 3 things to do now, each carrying the rule that selected it. Use this instead of reasoning over the whole backlog. Ordering is a fixed ladder — imminent (48h) > gating > someone is blocked on you > hardest course > by deadline > self-paced.',
    inputSchema: {
      type: 'object',
      properties: {
        limit: { type: 'integer', minimum: 1, maximum: 5, default: 3 },
        hardest_course: {
          type: 'string',
          description: "Topic substring for the course to prioritise, e.g. '470'.",
        },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'review_week',
    description: 'The weekly-review question: does this week fit? Compares estimated hours for everything due in the horizon against the slack actually available, and returns a concrete cut list when it does not. Never proposes cutting an imminent deadline or a gating item.',
    inputSchema: {
      type: 'object',
      properties: {
        available_hours: {
          type: 'number',
          description: 'Unreserved hours genuinely available this week, counted off the calendar.',
        },
        horizon_days: { type: 'integer', minimum: 1, maximum: 31, default: 7 },
        hardest_course: { type: 'string' },
      },
      required: ['available_hours'],
      additionalProperties: false,
    },
  },
  {
    name: 'list_overdue',
    description: 'List entries already past their due date, soonest first.',
    inputSchema: {
      type: 'object',
      properties: {
        limit: { type: 'integer', minimum: 1, maximum: 50, default: 5 },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'set_due_date',
    description: 'Set, move, or clear an entry deadline. Pass due_at as null to clear it — that is how an entry stops being a reminder.',
    inputSchema: {
      type: 'object',
      properties: {
        entry_id: { type: 'string' },
        due_at: {
          type: ['string', 'null'],
          description: 'ISO 8601 timestamp, or null to clear the deadline.',
        },
      },
      required: ['entry_id', 'due_at'],
      additionalProperties: false,
    },
  },
  {
    name: 'capture_task',
    description: 'Capture something with a deadline but no fixed time — a job application, an assignment, a follow-up — in one call. Defaults to the Inbox so capture never blocks on choosing a topic. For anything that has an actual time, use a calendar instead.',
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        due_at: { type: 'string', description: 'ISO 8601 timestamp. Optional.' },
        estimate_minutes: {
          type: 'integer',
          minimum: 1,
          description: 'Rough size in minutes. Optional, but review_week can only check feasibility against entries that have one.',
        },
        topic_id: { type: 'string' },
        topic_name: { type: 'string' },
        url: { type: 'string' },
        note: { type: 'string' },
      },
      required: ['title'],
      additionalProperties: false,
    },
  },
  {
    name: 'create_topic',
    description: 'Create a new topic.',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string' },
      },
      required: ['name'],
      additionalProperties: false,
    },
  },
  {
    name: 'create_entry',
    description: 'Create a single entry in a topic.',
    inputSchema: {
      type: 'object',
      properties: {
        topic_id: { type: 'string' },
        topic_name: { type: 'string' },
        url: { type: 'string' },
        title: { type: 'string' },
        note: { type: 'string' },
      },
      anyOf: [{ required: ['topic_id'] }, { required: ['topic_name'] }],
      additionalProperties: false,
    },
  },
  {
    name: 'bulk_create_entries',
    description: 'Create multiple entries in the same topic.',
    inputSchema: {
      type: 'object',
      properties: {
        topic_id: { type: 'string' },
        topic_name: { type: 'string' },
        entries: {
          type: 'array',
          minItems: 1,
          items: {
            type: 'object',
            properties: {
              url: { type: 'string' },
              title: { type: 'string' },
              note: { type: 'string' },
            },
            additionalProperties: false,
          },
        },
      },
      required: ['entries'],
      anyOf: [{ required: ['topic_id'] }, { required: ['topic_name'] }],
      additionalProperties: false,
    },
  },
  {
    name: 'move_entry',
    description: 'Move one entry from its current topic to another topic.',
    inputSchema: {
      type: 'object',
      properties: {
        entry_id: { type: 'string' },
        target_topic_id: { type: 'string' },
        target_topic_name: { type: 'string' },
      },
      required: ['entry_id'],
      anyOf: [{ required: ['target_topic_id'] }, { required: ['target_topic_name'] }],
      additionalProperties: false,
    },
  },
  {
    name: 'bulk_move_entries',
    description: 'Move multiple entries to the same destination topic.',
    inputSchema: {
      type: 'object',
      properties: {
        entry_ids: {
          type: 'array',
          minItems: 1,
          items: { type: 'string' },
        },
        target_topic_id: { type: 'string' },
        target_topic_name: { type: 'string' },
      },
      required: ['entry_ids'],
      anyOf: [{ required: ['target_topic_id'] }, { required: ['target_topic_name'] }],
      additionalProperties: false,
    },
  },
]
