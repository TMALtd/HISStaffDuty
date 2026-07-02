create extension if not exists pgcrypto;

create table if not exists public.student_academic_years (
  id uuid primary key default gen_random_uuid(),
  label text not null unique,
  starts_on date,
  ends_on date,
  is_active boolean not null default false,
  is_archived boolean not null default false,
  archived_by_email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists student_academic_years_single_active_idx
  on public.student_academic_years (is_active)
  where is_active = true;

create table if not exists public.student_roster_entries (
  id uuid primary key default gen_random_uuid(),
  academic_year_id uuid not null references public.student_academic_years(id) on delete cascade,
  class_code text not null default '',
  class_name text not null,
  school text not null,
  designation text not null,
  year_group text not null,
  milepost text not null,
  level text not null,
  school_id text not null,
  full_name text not null,
  surname text,
  first_name text,
  preferred_name text,
  gender text,
  form text not null,
  year_code text,
  tutor text,
  academic_house text,
  nationality text,
  current_school_name text,
  choice_of_programme text,
  admission_status text,
  offer_type text,
  conditional_offer_type text,
  source_filename text,
  imported_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (academic_year_id, school_id)
);

create index if not exists student_roster_entries_year_idx
  on public.student_roster_entries (academic_year_id);

create index if not exists student_roster_entries_class_idx
  on public.student_roster_entries (class_name);

create index if not exists student_roster_entries_school_idx
  on public.student_roster_entries (school);

create index if not exists student_roster_entries_year_group_idx
  on public.student_roster_entries (year_group);

alter table public.student_class_assignments
  add column if not exists academic_year_label text;

do $$
begin
  if exists (
    select 1
    from information_schema.table_constraints
    where table_schema = 'public'
      and table_name = 'student_class_assignments'
      and constraint_name = 'student_class_assignments_student_school_id_key'
  ) then
    alter table public.student_class_assignments
      drop constraint student_class_assignments_student_school_id_key;
  end if;
end $$;

create unique index if not exists student_class_assignments_year_student_idx
  on public.student_class_assignments (student_school_id, academic_year_label);

drop view if exists public.student_class_roster;
drop view if exists public.student_class_roster_legacy;

create view public.student_class_roster_legacy as
select
  c."Class Code" as class_code,
  c."Class Name" as class_name,
  c."School" as school,
  c."Designation" as designation,
  c."Year Group" as year_group,
  c."Milepost" as milepost,
  c."Level" as level,
  t."School Id"::text as school_id,
  t."Full Name" as full_name,
  null::text as surname,
  null::text as first_name,
  t."Preferred Name" as preferred_name,
  t."Gender" as gender,
  t."Form" as form,
  t."Year Code" as year_code,
  t."Tutor" as tutor,
  t."Academic House" as academic_house
from public."Term 3 Data" t
join public."Class List" c
  on c."Class Name" = t."Form";

create view public.student_class_roster as
with active_year as (
  select id
  from public.student_academic_years
  where is_active = true
  order by updated_at desc, created_at desc
  limit 1
)
select
  e.class_code,
  e.class_name,
  e.school,
  e.designation,
  e.year_group,
  e.milepost,
  e.level,
  e.school_id,
  e.full_name,
  e.surname,
  e.first_name,
  e.preferred_name,
  e.gender,
  e.form,
  e.year_code,
  e.tutor,
  e.academic_house
from public.student_roster_entries e
join active_year a
  on a.id = e.academic_year_id

union all

select
  legacy.class_code,
  legacy.class_name,
  legacy.school,
  legacy.designation,
  legacy.year_group,
  legacy.milepost,
  legacy.level,
  legacy.school_id::text as school_id,
  legacy.full_name,
  legacy.surname,
  legacy.first_name,
  legacy.preferred_name,
  legacy.gender,
  legacy.form,
  legacy.year_code,
  legacy.tutor,
  legacy.academic_house
from public.student_class_roster_legacy legacy
where not exists (select 1 from active_year);

comment on view public.student_class_roster is
'Active student roster view. Uses the selected academic year when one is live, otherwise falls back to the legacy Term 3 roster.';
