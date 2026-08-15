-- 0078 added `title_edited` defaulting to false for every existing row, which
-- silently threw away the distinction it exists to preserve: entries whose
-- title was already set by hand under the old code looked identical to entries
-- whose title merely mirrored the note, so the next note edit would revert
-- them — the exact bug 0078 set out to fix, still live for existing data.
--
-- Backfill it by recomputing what the mirrored title WOULD have been (the same
-- rule as computeTitle in src/lib/entryTitle.js: first `# Heading`, else first
-- non-empty line, else the URL, else 'Untitled') and marking every row whose
-- stored title diverges from it as deliberately edited.
--
-- Only ever sets the flag to true, never false: the failure mode is an entry
-- that stops mirroring when it could have kept mirroring, never a lost title.
update entries
set title_edited = true
-- A null title was never set by anyone, so it is not a deliberate one. Without
-- this guard `null is distinct from 'Untitled'` marks those rows as edited and
-- permanently freezes them titleless.
where title is not null
  and title is distinct from coalesce(
  nullif(substring(trim((regexp_match(coalesce(note, ''), '^#\s+(.+)$', 'n'))[1]) from 1 for 120), ''),
  nullif(substring((
    select trim(line)
    from unnest(string_to_array(coalesce(note, ''), E'\n')) as line
    where trim(line) <> ''
    limit 1
  ) from 1 for 120), ''),
  nullif(trim(coalesce(url, '')), ''),
  'Untitled'
);
