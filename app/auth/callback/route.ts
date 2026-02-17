import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";
import { getSupabasePublishableKey, getSupabaseUrl } from "@/lib/supabase/public-env";

/**
 * Auth callback handler.
 *
 * This route is required for PKCE-based email links (including password recovery)
 * so we can exchange the `code` for a session and set auth cookies on the response.
 *
 * Supabase will redirect users here with `?code=...`.
 * We then redirect them to `next` (default: "/").
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") || "/";

  // Determine the origin for redirection.
  // In live environments, we should use the protocol from NEXT_PUBLIC_SITE_URL if available.
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || url.origin;
  const siteOrigin = new URL(siteUrl).origin;

  const redirectUrl = new URL(next, siteOrigin);
  const response = NextResponse.redirect(redirectUrl);

  if (!code) {
    // Nothing to exchange; send user onward.
    return response;
  }

  const supabase = createServerClient(
    getSupabaseUrl(),
    getSupabasePublishableKey(),
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            console.log(`[Auth Callback] Setting cookie: ${name}`);
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  console.log("[Auth Callback] Exchanging code for session...");
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    // If the code is invalid/expired, forward user back to reset page with message.
    const fallback = new URL("/reset-password", url.origin);
    fallback.searchParams.set("error", error.message);
    return NextResponse.redirect(fallback);
  }

  return response;
}

