alter table public.staff
  add column if not exists can_view_class boolean not null default false,
  add column if not exists can_view_year_group_classes boolean not null default false;
