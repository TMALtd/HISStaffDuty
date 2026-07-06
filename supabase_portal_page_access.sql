create table if not exists public.portal_page_access (
  page_key text primary key,
  label text not null,
  is_enabled boolean not null default true,
  updated_at timestamptz not null default now()
);

insert into public.portal_page_access (page_key, label, is_enabled)
values
  ('student-filter', 'Students', true),
  ('duty', 'Duties', true),
  ('gradebook', 'Markbooks', true),
  ('timetables', 'Timetables', true),
  ('directory', 'Staff Directory', true)
on conflict (page_key) do update
set
  label = excluded.label,
  is_enabled = excluded.is_enabled,
  updated_at = now();
