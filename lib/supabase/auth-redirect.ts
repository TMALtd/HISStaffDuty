import { type NextRequest } from "next/server";

function isLocalhostHostname(hostname: string) {
  return /^(localhost|127\.0\.0\.1)$/i.test(hostname);
}

export function getAuthSiteUrl(request?: NextRequest) {
  const configuredSiteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();

  if (configuredSiteUrl) {
    try {
      const configuredUrl = new URL(configuredSiteUrl);
      if (!isLocalhostHostname(configuredUrl.hostname)) {
        return configuredUrl;
      }
    } catch {
      // Ignore malformed configured values and fall through to the request URL.
    }
  }

  if (request) {
    return new URL("/", request.url);
  }

  if (configuredSiteUrl) {
    return new URL(configuredSiteUrl);
  }

  throw new Error(
    "Unable to determine the public site URL. Configure NEXT_PUBLIC_SITE_URL for auth redirects."
  );
}

export function getAuthCallbackUrl(request?: NextRequest) {
  return new URL("/auth/callback", getAuthSiteUrl(request)).toString();
}
