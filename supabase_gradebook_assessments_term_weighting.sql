alter table public.gradebook_assessments
  alter column max_score drop not null;

alter table public.gradebook_assessments
  add column if not exists include_in_term boolean not null default false,
  add column if not exists weighting_percent numeric(6,2) null;
