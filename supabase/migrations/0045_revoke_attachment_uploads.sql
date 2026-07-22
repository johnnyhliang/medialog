-- MediaLog does not host files (decision 2026-07-09) — users hotlink instead
-- (docs/hotlinking.md). The upload UI is gone from the client, but the anon key
-- ships in the bundle, so anyone could still call storage.upload() directly.
-- THIS is the actual gate: revoke insert on the attachments bucket.
--
-- Read and delete stay owner-scoped so existing objects remain viewable in
-- FilesView and can be cleaned up by their owner. Purging the objects
-- themselves is a separate, deliberate decision.

drop policy if exists "attachments_insert_own" on storage.objects;
drop policy if exists "attachments_update_own" on storage.objects;

-- Shrink the bucket's ceiling too, so a future policy mistake can't turn into
-- a large storage bill.
update storage.buckets set file_size_limit = 0 where id = 'attachments';
