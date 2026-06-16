import { NextResponse, type NextRequest } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { getAuthSiteUrl } from "@/lib/supabase/auth-redirect";

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const tokenHash = requestUrl.searchParams.get("token_hash");
  const type = requestUrl.searchParams.get("type");
  const loginUrl = new URL("/login", getAuthSiteUrl(request));
  const response = NextResponse.redirect(new URL("/", getAuthSiteUrl(request)));

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

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      loginUrl.searchParams.set(
        "message",
        `Google sign-in could not be completed: ${error.message}`
      );
      return NextResponse.redirect(loginUrl);
    }
  } else if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: type as "magiclink"
    });
    if (error) {
      loginUrl.searchParams.set(
        "message",
        `Email sign-in could not be completed: ${error.message}`
      );
      return NextResponse.redirect(loginUrl);
    }
  } else {
    loginUrl.searchParams.set(
      "message",
      "Sign-in could not be completed because no authentication code was returned."
    );
    return NextResponse.redirect(loginUrl);
  }

  return response;
}
