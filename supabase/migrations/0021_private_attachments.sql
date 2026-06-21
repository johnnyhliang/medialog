-- Switch attachments bucket to private; all access goes through signed URLs.
update storage.buckets set public = false where id = 'attachments';
