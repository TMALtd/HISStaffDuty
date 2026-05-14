create extension if not exists pgcrypto;

create table if not exists public.timetable_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  school text,
  designation text,
  year_group text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.timetable_periods (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.timetable_templates(id) on delete cascade,
  weekday text not null check (weekday in ('monday', 'tuesday', 'wednesday', 'thursday', 'friday')),
  label text not null,
  start_time time not null,
  end_time time not null,
  block_type text not null default 'lesson' check (block_type in ('lesson', 'break', 'lunch', 'dismissal', 'assembly', 'other')),
  sort_order integer not null default 0
);

create table if not exists public.class_timetables (
  id uuid primary key default gen_random_uuid(),
  class_name text not null unique,
  template_id uuid not null references public.timetable_templates(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.timetable_blocks (
  id uuid primary key default gen_random_uuid(),
  class_timetable_id uuid not null references public.class_timetables(id) on delete cascade,
  period_id uuid not null references public.timetable_periods(id) on delete cascade,
  title text,
  block_type text not null default 'lesson' check (block_type in ('lesson', 'break', 'lunch', 'dismissal', 'assembly', 'other')),
  color text,
  notes text,
  start_time_override time,
  end_time_override time,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (class_timetable_id, period_id)
);

create table if not exists public.timetable_block_staff (
  block_id uuid not null references public.timetable_blocks(id) on delete cascade,
  staff_id text not null references public.staff(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (block_id, staff_id)
);

create index if not exists timetable_periods_template_weekday_idx
  on public.timetable_periods (template_id, weekday, sort_order, start_time);

create index if not exists timetable_blocks_class_timetable_idx
  on public.timetable_blocks (class_timetable_id, period_id);

create index if not exists timetable_block_staff_staff_idx
  on public.timetable_block_staff (staff_id);
