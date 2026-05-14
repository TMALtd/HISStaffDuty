export function getSupabaseConfig() {
  return {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "",
    anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ?? "",
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? ""
  };
}

export function hasSupabaseBrowserEnv() {
  const config = getSupabaseConfig();
  return Boolean(config.url && config.anonKey);
}

export function hasSupabaseAdminEnv() {
  const config = getSupabaseConfig();
  return Boolean(config.url && config.serviceRoleKey);
}

export function getSupabaseBrowserEnvError() {
  return "Supabase environment variables are missing. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to the runtime environment.";
}

export function getSupabaseAdminEnvError() {
  return "Supabase environment variables are missing. Add NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to the runtime environment.";
}
