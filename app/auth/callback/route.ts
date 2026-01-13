import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";

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

  // Always redirect somewhere (even if we can't exchange the code).
  const redirectUrl = new URL(next, url.origin);
  const response = NextResponse.redirect(redirectUrl);

  if (!code) {
    // Nothing to exchange; send user onward.
    return response;
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    // If the code is invalid/expired, forward user back to reset page with message.
    const fallback = new URL("/reset-password", url.origin);
    fallback.searchParams.set("error", error.message);
    return NextResponse.redirect(fallback);
  }

  return response;
}

