create extension if not exists pgcrypto;

create table if not exists public.specialist_registers (
  id uuid primary key default gen_random_uuid(),
  staff_profile_id uuid not null references public.staff(id) on delete cascade,
  subject_id uuid not null references public.gradebook_subjects(id) on delete cascade,
  academic_year_label text,
  year_group text not null,
  name text not null,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists specialist_registers_staff_idx
  on public.specialist_registers (staff_profile_id);

create index if not exists specialist_registers_subject_idx
  on public.specialist_registers (subject_id);

create index if not exists specialist_registers_year_group_idx
  on public.specialist_registers (year_group);

create unique index if not exists specialist_registers_staff_subject_year_name_idx
  on public.specialist_registers (staff_profile_id, subject_id, coalesce(academic_year_label, ''), year_group, name);

create table if not exists public.specialist_register_students (
  id uuid primary key default gen_random_uuid(),
  register_id uuid not null references public.specialist_registers(id) on delete cascade,
  student_school_id text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create unique index if not exists specialist_register_students_unique_idx
  on public.specialist_register_students (register_id, student_school_id);

create index if not exists specialist_register_students_register_idx
  on public.specialist_register_students (register_id, sort_order, created_at);

create or replace function public.specialist_registers_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_specialist_registers_updated_at on public.specialist_registers;

create trigger trg_specialist_registers_updated_at
before update on public.specialist_registers
for each row
execute function public.specialist_registers_set_updated_at();
