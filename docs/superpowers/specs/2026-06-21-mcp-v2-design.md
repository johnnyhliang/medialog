# MCP Server v2 Design

**Date:** 2026-06-21
**Phase:** C (after semantic search — agent needs embeddings to be useful)
**Status:** Spec / not yet planned

## Goal

Reconnect the MCP server to Claude Desktop (and eventually Claude.ai) so you can talk to your MediaLog library directly — "what have I saved about React performance?", "summarize my AI topic", "add this to my reading queue" — without leaving the chat.

## Why v2

The existing MCP server (`mcp-server/`) was built for an earlier version of the app. It doesn't know about: RSS feeds, files, applications/radar, topic lifecycle (archived/deleted), Wayback Machine data, version history, or the current DB schema. It needs to be rebuilt against the current shape.

## What the agent should be able to do

### Read (safe, always available)
- List topics (active only, not archived/deleted)
- Get entries for a topic (with tags, status, note preview)
- Search entries by keyword (and semantic similarity once Phase C is done)
- Get reading queue (active + backlog across all topics)
- Get recent activity (what was added/updated recently)
- Get digest data (captures this week, completions, stale entries)
- Get a specific entry by ID (full note text)

### Write (gated — require explicit confirmation in the tool description)
- Create entry (topic, url, title, note, tags)
- Update entry status (backlog/active/done)
- Add note to entry (append, not replace)
- Create topic

### Intentionally excluded
- Delete anything (too destructive for an agent)
- Archive/restore topics
- File uploads
- Auth / settings changes
- Bulk operations

## Architecture

The existing server structure (`server.js`, `router.js`, `operations/read.js`, `operations/write.js`) is the right shape — keep it. Rebuild the operations to match the current DB schema and add the new capabilities.

Tools use the Supabase JS client with the service role key (server-side, not exposed to browser). Each tool validates its inputs and returns structured JSON.

## Connection

- Claude Desktop: add to `claude_desktop_config.json` as a local stdio MCP server (`node mcp-server/src/server.js`)
- Auth: service role key in env var `SUPABASE_SERVICE_ROLE_KEY` (never committed)
- Future: Claude.ai remote MCP when the platform supports it

## Tool list (proposed)

```
medialog_list_topics
medialog_get_entries(topic_id, status?, limit?)
medialog_search(query, mode: 'keyword'|'semantic')
medialog_get_reading_queue(limit?)
medialog_get_recent_activity(limit?)
medialog_get_digest()
medialog_get_entry(entry_id)
medialog_create_entry(topic_id, url?, title?, note?, tags?)
medialog_update_status(entry_id, status)
medialog_append_note(entry_id, text)
medialog_create_topic(name)
```

## Constraints

- Build after semantic search (Phase C) — the agent is significantly more useful with semantic `medialog_search`
- Service role key must never be committed — env var only
- Write tools must have clear descriptions warning that they modify data
- No streaming responses — MCP stdio transport, return complete JSON
- Test locally with Claude Desktop before publishing
