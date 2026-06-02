import { NextResponse, type NextRequest } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { getSupabaseBrowserEnvError, hasSupabaseBrowserEnv } from "@/lib/supabase/config";
import { getAuthCallbackUrl, getAuthSiteUrl } from "@/lib/supabase/auth-redirect";

export async function GET(request: NextRequest) {
  const loginUrl = new URL("/login", getAuthSiteUrl(request));

  if (!hasSupabaseBrowserEnv()) {
    loginUrl.searchParams.set("message", getSupabaseBrowserEnvError());
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

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: getAuthCallbackUrl(request)
    }
  });

  if (error || !data.url) {
    loginUrl.searchParams.set("message", error?.message ?? "Unable to start Google sign-in.");
    return NextResponse.redirect(loginUrl);
  }

  const redirectResponse = NextResponse.redirect(data.url);
  response.cookies.getAll().forEach((cookie) => {
    redirectResponse.cookies.set(cookie);
  });
  return redirectResponse;
}
