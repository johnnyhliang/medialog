-- Add creator feeds (George Hotz / ThePrimeagen / aligrithm.com) to the founder
-- account directly, since re-running the starter pack in the UI only adds when
-- the user follows nothing yet. Idempotent: skips any URL already followed.

insert into feeds (user_id, name, url, category, kind)
select v.user_id, v.name, v.url, v.category, v.kind
from (values
  ('f50956f4-bb9c-45da-95e0-b351c7ee1dc3'::uuid, 'George Hotz (streams)', 'https://www.youtube.com/feeds/videos.xml?channel_id=UCwgKmJM4ZJQRJ-U5NjvR2dg', 'creators', 'rss'),
  ('f50956f4-bb9c-45da-95e0-b351c7ee1dc3'::uuid, 'ThePrimeagen', 'https://www.youtube.com/feeds/videos.xml?channel_id=UCUyeluBRhGPCW4rPe_UvBZQ', 'creators', 'rss'),
  ('f50956f4-bb9c-45da-95e0-b351c7ee1dc3'::uuid, 'ThePrimeTime (long-form)', 'https://www.youtube.com/feeds/videos.xml?channel_id=UC8ENHE5xdFSwx71u3fDH5Xw', 'creators', 'rss'),
  ('f50956f4-bb9c-45da-95e0-b351c7ee1dc3'::uuid, 'aligrithm.com', 'https://aligrithm.com/rss/', 'creators', 'rss')
) as v(user_id, name, url, category, kind)
where not exists (
  select 1 from feeds f where f.user_id = v.user_id and f.url = v.url
);
