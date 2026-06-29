alter table if exists public.staff
add column if not exists can_edit_own_timetable boolean not null default false;
