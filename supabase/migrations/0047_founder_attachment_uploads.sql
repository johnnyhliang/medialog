-- Re-enable attachment uploads, but ONLY for founder accounts.
--
-- 0045 revoked all inserts on the attachments bucket (MediaLog hosts no files
-- for general users). Uploads are useful for the founder, though, so grant them
-- back scoped to a hardcoded founder id. Regular users still cannot write to
-- the bucket even by calling storage.upload() directly with the anon key — the
-- policy, not the client UI, is the gate.
--
-- Client mirrors this: src/lib/account.js VITE_FOUNDER_IDS. Keep the two in
-- sync when you add a founder. The id here must match an auth.users id.

-- Owner-folder scoping is preserved: a founder can only write under their own
-- {uid}/ prefix, so this can never touch another user's objects.
create policy "attachments_insert_founder" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'attachments'
    and (storage.foldername(name))[1] = auth.uid()::text
    and auth.uid() = 'f50956f4-bb9c-45da-95e0-b351c7ee1dc3'
  );

create policy "attachments_update_founder" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'attachments'
    and (storage.foldername(name))[1] = auth.uid()::text
    and auth.uid() = 'f50956f4-bb9c-45da-95e0-b351c7ee1dc3'
  );

-- 0045 set the bucket ceiling to 0; restore the 10 MB per-object limit the
-- client enforces (isAllowedAttachment).
update storage.buckets set file_size_limit = 10485760 where id = 'attachments';
