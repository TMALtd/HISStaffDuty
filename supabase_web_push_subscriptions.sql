create table if not exists public.web_push_subscriptions (
  endpoint text primary key,
  p256dh_key text not null,
  auth_key text not null,
  staff_email text null,
  staff_name text null,
  team_label text null,
  user_agent text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
