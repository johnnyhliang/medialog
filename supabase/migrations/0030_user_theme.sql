alter table user_configs
  add column if not exists theme jsonb default '{"palette":"warm","style":"default"}';
