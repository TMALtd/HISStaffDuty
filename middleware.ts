import { NextResponse, type NextRequest } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { getSupabaseBrowserEnvError, getSupabaseConfig, hasSupabaseBrowserEnv } from "@/lib/supabase/config";

const PUBLIC_PATHS = ["/login", "/auth/callback", "/auth/google", "/auth/magic-link"];

function isPublicPath(pathname: string) {
  return pathname.startsWith("/api/") || PUBLIC_PATHS.some((path) => pathname.startsWith(path));
}

export async function middleware(request: NextRequest) {
  if (!hasSupabaseBrowserEnv()) {
    if (request.nextUrl.pathname === "/login") {
      const response = NextResponse.next({ request });
      response.headers.set("x-config-warning", getSupabaseBrowserEnvError());
      return response;
    }

    if (!isPublicPath(request.nextUrl.pathname)) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("message", getSupabaseBrowserEnvError());
      loginUrl.searchParams.set("next", request.nextUrl.pathname);
      return NextResponse.redirect(loginUrl);
    }

    return NextResponse.next({ request });
  }

  let response = NextResponse.next({ request });
  const config = getSupabaseConfig();

  const supabase = createServerClient(
    config.url,
    config.anonKey,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          request.cookies.set({ name, value, ...options });
          response.cookies.set({ name, value, ...options });
        },
        remove(name: string, options: CookieOptions) {
          request.cookies.set({ name, value: "", ...options });
          response.cookies.set({ name, value: "", ...options });
        }
      }
    }
  );

  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user && !isPublicPath(request.nextUrl.pathname)) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (
    user &&
    request.nextUrl.pathname === "/login" &&
    !request.nextUrl.searchParams.get("message")
  ) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return response;
}

export const config = {
  // Skip static assets so public files like the login-page logo can load
  // without being redirected through auth middleware.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)"]
};
