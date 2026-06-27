create extension if not exists pgcrypto;

create table if not exists public.student_class_assignments (
  id uuid primary key default gen_random_uuid(),
  student_school_id text not null unique,
  class_name text not null,
  class_code text,
  assigned_by_email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists student_class_assignments_class_name_idx
  on public.student_class_assignments (class_name);

create index if not exists student_class_assignments_class_code_idx
  on public.student_class_assignments (class_code);
