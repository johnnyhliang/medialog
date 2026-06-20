# MediaLog MCP Server

This folder contains a dedicated Model Context Protocol server for MediaLog.
It is intentionally scoped to safe, non-destructive app actions only.

## Layout

- `server.js` - process entry point
- `src/server.js` - MCP lifecycle and request handling
- `src/router.js` - tool dispatch
- `src/tools.js` - tool definitions and schemas
- `src/operations/read.js` - read-only app queries
- `src/operations/write.js` - create and move operations
- `src/jsonrpc.js` - stdio JSON-RPC encoding/decoding
- `src/config.js` - env loading and Supabase client setup
- `src/helpers.js` - small shared utility functions
- `config/claude-desktop.example.json` - local Claude Desktop connector template
- `config/openai-chatgpt.md` - OpenAI/ChatGPT usage note

## What it can access

The server talks to the same Supabase-backed data model as the app:

- `topics`
- `entries`
- `tags` only as part of entry reads
- `entry_tags` only as part of entry reads

It does not expose arbitrary SQL, filesystem access, shell access, or browser state.
It is meant to run against the MediaLog Supabase project only.

## Supported tools

Read-only:

- `list_topics`
- `list_entries_by_topic`
- `search_entries`
- `list_inbox`
- `get_dashboard_overview`
- `get_topic_progress`
- `list_revisit_queue`
- `list_recent_activity`
- `list_trash`

Write-safe:

- `create_topic`
- `create_entry`
- `bulk_create_entries`
- `move_entry`
- `bulk_move_entries`

## Explicitly out of scope

The server does not expose:

- hard delete
- soft delete
- trash emptying
- restore from trash
- tag creation or tag mutation
- note/title/url editing on existing entries
- pinning
- status changes
- version history writes
- export/backup actions
- GitHub sync
- auth/session management

Those actions stay in the app UI until they are deliberately added here.

## Configuration

Set these environment variables before starting the server:

- `MCP_SUPABASE_URL`
- `MCP_SUPABASE_SERVICE_ROLE_KEY`

Optional fallbacks:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

The service-role key is the recommended setup for local MCP usage because the server
needs to read and write the project directly, independent of the browser session.

## Run

```bash
cd mcp-server
npm start
```

## Connector examples

### Claude Desktop

Add a server block to Claude Desktop's MCP config file:

```json
{
  "mcpServers": {
    "medialog": {
      "command": "node",
      "args": ["C:/Users/liang/Documents/medialog/mcp-server/server.js"],
      "env": {
        "MCP_SUPABASE_URL": "https://YOUR_PROJECT.supabase.co",
        "MCP_SUPABASE_SERVICE_ROLE_KEY": "YOUR_SERVICE_ROLE_KEY"
      }
    }
  }
}
```

If you prefer a shell wrapper, point `command` at the shell you already use and keep the
same `args`/`env`.

You can copy `config/claude-desktop.example.json` and replace the placeholder values.

### ChatGPT / OpenAI

OpenAI's current official developer docs describe ChatGPT apps as being built with the
Apps SDK, which is previewed as an open standard built on MCP. The documented path is:

- build the app with the Apps SDK
- expose your app's tools through MCP
- test in ChatGPT Developer Mode

See OpenAI's official announcement: [Introducing apps in ChatGPT and the new Apps SDK](https://openai.com/index/introducing-apps-in-chatgpt/)

If you just want to use this MCP server from a desktop client today, Claude Desktop is the
cleanest direct config target. For OpenAI, the server is the backend piece; the UI/client
layer lives in the Apps SDK path.

## Notes

- `list_inbox` and `get_dashboard_overview` mirror the app's sort/home views.
- `get_topic_progress` mirrors the topic progress view.
- `list_trash` is read-only and does not restore or delete anything.
