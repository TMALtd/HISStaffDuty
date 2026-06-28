create table if not exists public.gradebook_assessments (
  id uuid primary key default gen_random_uuid(),
  subject_id uuid not null references public.gradebook_subjects(id) on delete cascade,
  class_name text null,
  assessment_name text not null,
  assessment_date date not null,
  max_score numeric(10,2) null,
  include_in_term boolean not null default false,
  weighting_percent numeric(6,2) null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (subject_id, class_name, assessment_name, assessment_date)
);

create or replace function public.set_gradebook_assessments_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists gradebook_assessments_set_updated_at on public.gradebook_assessments;

create trigger gradebook_assessments_set_updated_at
before update on public.gradebook_assessments
for each row
execute function public.set_gradebook_assessments_updated_at();

alter table public.gradebook_assessments
  alter column max_score drop not null;

alter table public.gradebook_assessments
  add column if not exists include_in_term boolean not null default false,
  add column if not exists weighting_percent numeric(6,2) null;
