function decodeSupabaseJwtRole(token: string) {
  const parts = token.split(".");
  if (parts.length < 2) {
    return null;
  }

  try {
    const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8")) as {
      role?: unknown;
    };
    return typeof payload.role === "string" ? payload.role : null;
  } catch {
    return null;
  }
}

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
  return Boolean(config.url && config.serviceRoleKey && decodeSupabaseJwtRole(config.serviceRoleKey) === "service_role");
}

export function getSupabaseBrowserEnvError() {
  return "Supabase environment variables are missing. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to the runtime environment.";
}

export function getSupabaseAdminEnvError() {
  return "Supabase admin configuration is missing or invalid. Add NEXT_PUBLIC_SUPABASE_URL and a valid SUPABASE_SERVICE_ROLE_KEY (role: service_role) to the runtime environment.";
}
