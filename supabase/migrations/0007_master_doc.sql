-- Living topic docs: each topic gets a master markdown document.
alter table topics add column master_doc text not null default '';
