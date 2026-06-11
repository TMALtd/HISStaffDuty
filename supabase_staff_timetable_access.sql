begin;

alter table public.staff
  add column if not exists can_view_own_timetable boolean not null default false;

alter table public.staff
  add column if not exists can_view_year_group_timetables boolean not null default false;

alter table public.staff
  add column if not exists timetable_access_year_group text;

commit;

select
  name,
  email,
  class,
  system_role,
  can_view_own_timetable,
  can_view_year_group_timetables,
  timetable_access_year_group
from public.staff
order by name;
