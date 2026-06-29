create table if not exists public.gradebook_terms (
  id uuid primary key default gen_random_uuid(),
  term_key text not null unique,
  term_label text not null,
  start_date date null,
  end_date date null,
  sort_order integer not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.set_gradebook_terms_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists gradebook_terms_set_updated_at on public.gradebook_terms;

create trigger gradebook_terms_set_updated_at
before update on public.gradebook_terms
for each row
execute function public.set_gradebook_terms_updated_at();

insert into public.gradebook_terms (term_key, term_label, sort_order)
values
  ('term-1', 'Term 1', 1),
  ('term-2', 'Term 2', 2),
  ('term-3', 'Term 3', 3)
on conflict (term_key) do update
set
  term_label = excluded.term_label,
  sort_order = excluded.sort_order;

alter table public.gradebook_assessments
  add column if not exists term_key text null references public.gradebook_terms(term_key) on update cascade;
