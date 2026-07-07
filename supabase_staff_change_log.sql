create extension if not exists pgcrypto;

create table if not exists public.staff_change_log (
  id uuid primary key default gen_random_uuid(),
  staff_record_id text not null,
  staff_id text null,
  field_name text not null,
  old_value text null,
  new_value text null,
  changed_by_email text null,
  change_source text not null default 'staff-directory',
  changed_at timestamptz not null default now()
);

create index if not exists staff_change_log_staff_record_idx
  on public.staff_change_log (staff_record_id);

create index if not exists staff_change_log_staff_id_idx
  on public.staff_change_log (staff_id);

create index if not exists staff_change_log_changed_at_idx
  on public.staff_change_log (changed_at desc);

create index if not exists staff_change_log_field_idx
  on public.staff_change_log (field_name);
