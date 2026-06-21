-- Enforce sane length limits that the UI already implies.
alter table topics
  add constraint topic_name_length
  check (char_length(name) <= 120);

alter table entries
  add constraint entry_note_length
  check (char_length(note) <= 100000);

alter table entries
  add constraint entry_title_length
  check (title is null or char_length(title) <= 500);

alter table entries
  add constraint entry_url_length
  check (url is null or char_length(url) <= 2048);
