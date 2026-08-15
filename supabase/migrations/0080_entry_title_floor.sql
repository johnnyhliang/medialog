-- "Every entry has a title" was an invariant enforced only in JavaScript, in
-- src/lib/db/entries.js. That binds callers going through the db layer and
-- nothing else — not the Deno edge functions, not a bulk import handing through
-- a null, not a manual insert. On 2026-06-18 one import produced 182 rows with
-- a null title, and they stayed that way for two months because nothing at the
-- database level required otherwise.
--
-- This puts the floor where it cannot be bypassed.

-- The same rule as computeTitle() in src/lib/entryTitle.js: first `# Heading`,
-- else first non-empty line, else the url, else 'Untitled'. Defined once here
-- so the trigger and any future backfill share a single copy.
--
-- KEEP IN SYNC with src/lib/entryTitle.js. Two languages, one rule — the cost
-- of enforcing it below the application.
create or replace function entry_auto_title(note text, url text)
returns text
language sql
immutable
as $$
  select coalesce(
    nullif(substring(btrim((regexp_match(coalesce(note, ''), '^#\s+(.+)$', 'n'))[1]) from 1 for 120), ''),
    nullif(substring((
      select btrim(line)
      from unnest(string_to_array(coalesce(note, ''), E'\n')) as line
      where btrim(line) <> ''
      limit 1
    ) from 1 for 120), ''),
    -- Sliced to 120 like the branches above. Urls may be 2048 chars but
    -- entry_title_length (migration 0020) caps titles at 500, so an
    -- untruncated url here fails the constraint outright.
    nullif(substring(btrim(coalesce(url, '')) from 1 for 120), ''),
    'Untitled'
  );
$$;

-- INSERT only, deliberately. Mirroring on UPDATE is the application's job: it
-- has to distinguish a user-owned title from an automatic one (`title_edited`),
-- and duplicating that decision here would put the same rule in two languages
-- where they can drift. This trigger only guarantees a row never *begins* life
-- without a title.
create or replace function fill_entry_title()
returns trigger
language plpgsql
as $$
begin
  if new.title is null or btrim(new.title) = '' then
    new.title := entry_auto_title(new.note, new.url);
  end if;
  return new;
end;
$$;

drop trigger if exists entries_fill_title on entries;
create trigger entries_fill_title
  before insert on entries
  for each row
  execute function fill_entry_title();

-- Give the existing titleless rows the same floor. `title_edited` is left false
-- on purpose: a url-as-title is a placeholder, so a later link-preview pass is
-- still free to replace it with the real page title.
update entries
set title = entry_auto_title(note, url)
where title is null or btrim(title) = '';
