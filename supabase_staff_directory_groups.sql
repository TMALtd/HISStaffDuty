alter table public.staff
  add column if not exists team text null,
  add column if not exists sub_team text null,
  add column if not exists year_group_label text null,
  add column if not exists milepost_label text null;
