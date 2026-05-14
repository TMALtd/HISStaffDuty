import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import {
  getSupabaseAdminEnvError,
  getSupabaseBrowserEnvError,
  getSupabaseConfig,
  hasSupabaseAdminEnv,
  hasSupabaseBrowserEnv
} from "@/lib/supabase/config";

export function createSupabaseServerClient() {
  if (!hasSupabaseBrowserEnv()) {
    throw new Error(getSupabaseBrowserEnvError());
  }

  const cookieStore = cookies();
  const config = getSupabaseConfig();

  return createServerClient(
    config.url,
    config.anonKey,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set() {},
        remove() {}
      }
    }
  );
}

export function createSupabaseAdminClient() {
  if (!hasSupabaseAdminEnv()) {
    throw new Error(getSupabaseAdminEnvError());
  }

  const config = getSupabaseConfig();

  return createClient(
    config.url,
    config.serviceRoleKey,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  );
}
