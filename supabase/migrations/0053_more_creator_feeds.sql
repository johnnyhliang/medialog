-- More verified-active creator/writer feeds for the founder account, in the
-- geohot/primeagen/quant lane. Idempotent: skips any URL already followed.

insert into feeds (user_id, name, url, category, kind)
select v.user_id, v.name, v.url, v.category, v.kind
from (values
  ('f50956f4-bb9c-45da-95e0-b351c7ee1dc3'::uuid, 'Tsoding', 'https://www.youtube.com/feeds/videos.xml?channel_id=UCrqM0Ym_NbK1fqeQG2VIohg', 'creators', 'rss'),
  ('f50956f4-bb9c-45da-95e0-b351c7ee1dc3'::uuid, 'Jonhoo (Rust)', 'https://www.youtube.com/feeds/videos.xml?channel_id=UC_iD0xppBwwsrM9DegC5cQQ', 'creators', 'rss'),
  ('f50956f4-bb9c-45da-95e0-b351c7ee1dc3'::uuid, 'Low Level', 'https://www.youtube.com/feeds/videos.xml?channel_id=UCzEaIT_yUdxixGEc8mINGmg', 'creators', 'rss'),
  ('f50956f4-bb9c-45da-95e0-b351c7ee1dc3'::uuid, 'Andrej Karpathy', 'https://www.youtube.com/feeds/videos.xml?channel_id=UCYO_jab_esuFRV4b17AJtAw', 'creators', 'rss'),
  ('f50956f4-bb9c-45da-95e0-b351c7ee1dc3'::uuid, 'Casey Muratori (Computer Enhance)', 'https://www.computerenhance.com/feed', 'writers', 'rss'),
  ('f50956f4-bb9c-45da-95e0-b351c7ee1dc3'::uuid, 'Xe Iaso', 'https://xeiaso.net/blog.rss', 'writers', 'rss'),
  ('f50956f4-bb9c-45da-95e0-b351c7ee1dc3'::uuid, 'Drew DeVault', 'https://drewdevault.com/blog/index.xml', 'writers', 'rss'),
  ('f50956f4-bb9c-45da-95e0-b351c7ee1dc3'::uuid, 'Antirez', 'https://antirez.com/rss', 'writers', 'rss'),
  ('f50956f4-bb9c-45da-95e0-b351c7ee1dc3'::uuid, 'ryg / Fabian Giesen', 'https://fgiesen.wordpress.com/feed/', 'writers', 'rss')
) as v(user_id, name, url, category, kind)
where not exists (
  select 1 from feeds f where f.user_id = v.user_id and f.url = v.url
);
