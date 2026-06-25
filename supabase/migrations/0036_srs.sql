alter table entries
  add column if not exists srs_interval  int     not null default 1,
  add column if not exists srs_reps      int     not null default 0,
  add column if not exists srs_ef        float4  not null default 2.5;
