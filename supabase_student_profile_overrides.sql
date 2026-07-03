create extension if not exists pgcrypto;

create table if not exists public.student_profile_overrides (
  id uuid primary key default gen_random_uuid(),
  student_school_id text not null,
  academic_year_label text not null default '',
  school text null,
  designation text null,
  year_group text null,
  milepost text null,
  level text null,
  full_name text null,
  surname text null,
  first_name text null,
  preferred_name text null,
  gender text null,
  nationality text null,
  form text null,
  year_code text null,
  tutor text null,
  academic_house text null,
  updated_by_email text null,
  updated_at timestamptz not null default now()
);

create unique index if not exists student_profile_overrides_student_year_idx
  on public.student_profile_overrides (student_school_id, academic_year_label);
