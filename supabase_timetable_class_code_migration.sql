alter table public.class_timetables
  add column if not exists class_code text;

update public.class_timetables as ct
set class_code = c."Class Code"
from public."Class List" as c
where ct.class_code is null
  and ct.class_name = c."Class Name";

alter table public.class_timetables
  alter column class_name set not null;

do $$
begin
  if exists (
    select 1
    from public.class_timetables
    where class_code is null
  ) then
    raise exception 'Some timetable rows could not be mapped to a class_code. Check class_name values in class_timetables against "Class List".';
  end if;
end $$;

alter table public.class_timetables
  alter column class_code set not null;

do $$
begin
  if exists (
    select 1
    from pg_indexes
    where schemaname = 'public'
      and tablename = 'class_timetables'
      and indexname = 'class_timetables_class_name_key'
  ) then
    execute 'alter table public.class_timetables drop constraint class_timetables_class_name_key';
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'class_timetables_class_code_key'
  ) then
    alter table public.class_timetables
      add constraint class_timetables_class_code_key unique (class_code);
  end if;
end $$;
