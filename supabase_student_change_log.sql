create extension if not exists pgcrypto;

create table if not exists public.student_change_log (
  id uuid primary key default gen_random_uuid(),
  student_school_id text not null,
  academic_year_label text not null default '',
  field_name text not null,
  old_value text null,
  new_value text null,
  changed_by_email text null,
  change_source text not null default 'student-editor',
  changed_at timestamptz not null default now()
);

create index if not exists student_change_log_student_idx
  on public.student_change_log (student_school_id);

create index if not exists student_change_log_year_idx
  on public.student_change_log (academic_year_label);

create index if not exists student_change_log_changed_at_idx
  on public.student_change_log (changed_at desc);

create index if not exists student_change_log_field_idx
  on public.student_change_log (field_name);
