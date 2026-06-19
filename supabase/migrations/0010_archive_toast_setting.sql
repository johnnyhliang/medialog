alter table user_configs add column if not exists archive_toast boolean not null default true;
