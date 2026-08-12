-- Titles mirror the entry's first line (or its `# Heading`) until the user
-- edits the title directly. Previously `updateEntry` recomputed the title
-- from the note on every note save, so editing the title and then touching
-- the note at all silently reverted it back to mirroring — no way to keep a
-- custom title once you'd made one. `title_edited` marks "this title was
-- set on purpose, stop mirroring", the same behavior Obsidian gives you.
alter table entries add column if not exists title_edited boolean not null default false;
