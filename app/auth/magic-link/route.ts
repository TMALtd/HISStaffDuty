import { NextResponse, type NextRequest } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { getSupabaseBrowserEnvError, hasSupabaseBrowserEnv } from "@/lib/supabase/config";
import { getAuthCallbackUrl, getAuthSiteUrl } from "@/lib/supabase/auth-redirect";

export async function POST(request: NextRequest) {
  const loginUrl = new URL("/login", getAuthSiteUrl(request));

  if (!hasSupabaseBrowserEnv()) {
    loginUrl.searchParams.set("message", getSupabaseBrowserEnvError());
    return NextResponse.redirect(loginUrl);
  }

  const formData = await request.formData();
  const email = String(formData.get("email") ?? "").trim();
  if (!email) {
    loginUrl.searchParams.set("message", "Enter your staff email before requesting a magic link.");
    return NextResponse.redirect(loginUrl);
  }

  const response = NextResponse.next();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          response.cookies.set({ name, value, ...options });
        },
        remove(name: string, options: CookieOptions) {
          response.cookies.set({ name, value: "", ...options });
        }
      }
    }
  );

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: getAuthCallbackUrl(request)
    }
  });

  loginUrl.searchParams.set(
    "message",
    error ? error.message : "Magic link sent. Check your email to continue."
  );

  const redirectResponse = NextResponse.redirect(loginUrl);
  response.cookies.getAll().forEach((cookie) => {
    redirectResponse.cookies.set(cookie);
  });
  return redirectResponse;
}
