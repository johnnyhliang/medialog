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
    description: 'List non-deleted entries for a topic, ordered the same way the app shows them.',
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
