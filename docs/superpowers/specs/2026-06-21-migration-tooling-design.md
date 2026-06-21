# Migration Tooling Design

**Date:** 2026-06-21
**Phase:** 1 (make it your daily tool)
**Status:** Ready to plan

## Goal

Get existing content into MediaLog with minimal friction so the switch from browser tabs + Obsidian + iPhone Notes actually happens. The migration is the adoption blocker.

## Three migration paths

### Path 1: Chrome tabs (OneTab dump)

**The problem:** Hundreds of open tabs with no notes, no memory of why they were opened. Value is uncertain — some matter, most don't.

**The approach:** Controlled burn. Export all tabs as a URL list (OneTab extension → "Export to text"), paste into bulk importer → all land in Inbox as `backlog` entries. Titles auto-fetched. Browser tabs can be closed immediately. Triage via Sort Inbox over time; anything not triaged in 30 days is deleted without guilt.

**What already exists:** Bulk import (paste URL list) + Sort Inbox triage + enrich auto-title. This path works TODAY with existing tools. No new code needed — just documentation and a OneTab guide.

**Gap:** OneTab exports as `title - url` per line, not bare URLs. The bulk importer needs to handle this format (currently expects bare URLs or newline-separated URLs).

### Path 2: iPhone Notes / Google Keep

**The problem:** Quick jots in Notes app — short text, no URLs, no structure.

**The approach:** Apple Notes exports to HTML (Files app → share → export). Google Keep exports via Google Takeout as JSON. Need an import page that accepts:
- Pasted text (each paragraph = one entry) for manual copy-paste of individual notes
- HTML file upload (Notes export) → parse `<div>` blocks → entries
- JSON file upload (Keep takeout) → parse notes array → entries

All land in Inbox. User picks topic during Sort Inbox.

**New UI needed:** Import wizard in Settings or a dedicated ImportView — file upload + format selector (plain text / Apple Notes HTML / Google Keep JSON) + preview before import.

### Path 3: Obsidian vault

**The problem:** Markdown files in a folder structure, some with frontmatter, some with `[[wikilinks]]`, some with headers and bullet lists. Variable quality.

**The approach:** Zip upload → unzip in-browser → parse each `.md` file as one entry. File path becomes the topic suggestion (e.g. `AI/paper-notes.md` → topic `AI`, title `paper-notes`). Frontmatter `tags:` → tags. Body → note field. Wikilinks stripped to plain text (no linking yet).

**New UI needed:** Obsidian import tab in Settings — zip upload, preview of parsed entries with topic mapping UI ("files under `AI/` → topic: AI"), confirm → bulk insert.

## Architecture

- `src/lib/parseMigration.js` — pure parsers: `parseOneTab(text)`, `parseAppleNotesHtml(html)`, `parseKeepJson(json)`, `parseObsidianZip(file)` → all return `Array<{ title, url, note, suggestedTopic }>`
- `src/components/MigrationView.jsx` — tabbed import wizard (Tabs → file upload → preview table → confirm)
- Nav item: "Import" in sidebar (or inside Settings)
- Reuses `bulkCreateEntries` from `src/lib/db/entries.js`

## Constraints

- All parsing is client-side (no server upload of private notes)
- Preview before import — never blind-import without showing what will be created
- All imported entries land in Inbox, not auto-filed to topics
- OneTab format (`title - url`) must be handled alongside bare URLs in bulk importer
- Obsidian zip must be unzipped client-side (JSZip already a dependency)
- Failed parses (malformed files) show a warning, don't abort the import
