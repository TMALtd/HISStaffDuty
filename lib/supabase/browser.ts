"use client";

import { createBrowserClient } from "@supabase/ssr";
import {
  getSupabaseBrowserEnvError,
  getSupabaseConfig,
  hasSupabaseBrowserEnv
} from "@/lib/supabase/config";

export function createSupabaseBrowserClient() {
  if (!hasSupabaseBrowserEnv()) {
    throw new Error(getSupabaseBrowserEnvError());
  }

  const config = getSupabaseConfig();

  return createBrowserClient(
    config.url,
    config.anonKey
  );
}
