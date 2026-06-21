# Conversation Capture Design

**Date:** 2026-06-21
**Phase:** 1 (make it your daily tool)
**Status:** Ready to plan

## Goal

Give AI conversations a permanent, structured home in MediaLog so good ideas from chats with Claude, ChatGPT, Gemini etc. stop being lost to browser history or messy copy-pastes into notes.

## The problem

Current workflow: have a useful AI conversation → copy-paste the whole thing into an iPhone Note or Obsidian file → lose it anyway because there's no structure and retrieval is impossible.

What's needed: a capture path that's fast enough to actually use, and stores conversations in a way that makes them findable and useful later.

## What a conversation entry is

A conversation entry is a regular entry with:
- `title` — user-written summary of what the chat was about ("Claude: how to structure a Supabase RLS policy")
- `note` — the conversation content (can be pasted markdown, or structured as Q/A pairs)
- `url` — optional link to the shared conversation (Claude.ai share link, ChatGPT share link)
- `tags` — `#ai-chat` always, plus topic tags (`#supabase`, `#career`, etc.)
- `status` — `done` if the conversation is complete and captured, `active` if ongoing

No new entry type needed — this is a tagging convention, not a schema change.

## Capture paths

### Path A: Paste (primary)
Quick-add form with a "Conversation" mode toggle — switches the note field to a larger textarea with placeholder "Paste conversation here…". Auto-tags `#ai-chat`. User adds title + topic. Done.

This is 90% of the use case and requires minimal new code — just a mode toggle on QuickAdd.

### Path B: URL only
Paste a Claude.ai or ChatGPT share URL → enrich fetches the page title → entry created with `#ai-chat` tag. Note field is empty (user can add takeaways later). Fast but low-fidelity.

### Path C: Structured import (future)
Claude.ai and ChatGPT both offer conversation export (JSON). A future import path could parse the JSON → format as markdown Q/A pairs → paste into note. Low priority — Path A covers the need.

## UI changes

- **QuickAdd:** add a `#ai-chat` shortcut tag button alongside the form (one click tags + sets larger note area)
- **No new view needed** — conversations live in the topic they belong to, findable via search and the `#ai-chat` tag filter

## Retrieval

The `#ai-chat` tag makes all conversations filterable in the browse view. Semantic search (Phase C) will make them findable by meaning. For now, keyword search over the note field is sufficient.

## Constraints

- No new DB schema — uses existing entries table
- No scraping of chat platforms (terms of service risk) — paste only
- `#ai-chat` is the canonical tag — not enforced, just the convention
- Conversation entries belong to a topic like any other entry — forces the triage habit
