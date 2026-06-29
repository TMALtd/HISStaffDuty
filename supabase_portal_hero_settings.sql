create table if not exists public.portal_hero_settings (
  page_key text primary key,
  label text not null,
  eyebrow text not null,
  title text not null,
  description text not null,
  updated_at timestamptz not null default now()
);

create or replace function public.touch_portal_hero_settings_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists portal_hero_settings_touch_updated_at on public.portal_hero_settings;
create trigger portal_hero_settings_touch_updated_at
before update on public.portal_hero_settings
for each row
execute function public.touch_portal_hero_settings_updated_at();

insert into public.portal_hero_settings (page_key, label, eyebrow, title, description)
values
  (
    'student-filter',
    'Student Filter',
    'Render-ready staff workspace',
    'Student filter portal',
    'Narrow the roster from school all the way down to class, then review the matching students in one place.'
  ),
  (
    'markbook',
    'Markbook',
    'Markbook workspace',
    'Build the class markbook around real teaching sections',
    'This new workspace is organised the same way your class markbook works in practice: student profiles, parent meeting notes, and subject assessment areas such as Phonics, Reading, Writing, Maths, and IPC.'
  ),
  (
    'timetables-admin',
    'Timetables Admin',
    'Timetable administration',
    'Build and manage class timetables',
    'Create one weekly timetable per class, attach it to a reusable period template, and then fill each block with lessons and teachers.'
  ),
  (
    'timetables-view',
    'Timetables View',
    'Timetable access',
    'View class timetables',
    'Open the timetable cards you have access to and review the class schedules in a cleaner read-only view.'
  )
on conflict (page_key) do update
set
  label = excluded.label,
  eyebrow = excluded.eyebrow,
  title = excluded.title,
  description = excluded.description,
  updated_at = now();
