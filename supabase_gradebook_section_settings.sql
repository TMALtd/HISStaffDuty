create table if not exists public.gradebook_section_settings (
  slug text primary key,
  name text not null,
  description text not null,
  recommended_page_name text not null,
  empty_state_title text not null,
  empty_state_copy text not null,
  updated_at timestamptz not null default now()
);

create or replace function public.gradebook_section_settings_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_gradebook_section_settings_updated_at on public.gradebook_section_settings;
create trigger trg_gradebook_section_settings_updated_at
before update on public.gradebook_section_settings
for each row
execute function public.gradebook_section_settings_set_updated_at();
