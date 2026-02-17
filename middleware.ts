import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

const ROUTE_SEGMENT_MAP: Record<string, string> = {
  "tableau-de-bord": "dashboard",
  "etudiant": "student",
  "paiements": "payments",
  "profil": "profile",
  "formations": "courses",
  "apprendre": "learn",
  "cohorte": "cohorts",
  "panier": "cart",
  "paiement": "payment",
  "checkout": "payment",
  "a-propos": "about",
  "politique-de-confidentialite": "privacy-policy",
  "termes-et-conditions": "terms-and-conditions",
  "investisseur": "investor",
  "poser-question": "ask-question",
};

function translatePath(pathname: string) {
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length === 0) return pathname;

  const mappedSegments = segments.map((segment) => ROUTE_SEGMENT_MAP[segment] ?? segment);
  const translated = `/${mappedSegments.join("/")}`;
  return translated === pathname ? pathname : translated;
}

export async function middleware(request: NextRequest) {
  const translatedPath = translatePath(request.nextUrl.pathname);
  if (translatedPath !== request.nextUrl.pathname) {
    const url = request.nextUrl.clone();
    url.pathname = translatedPath;
    return NextResponse.redirect(url);
  }

  // Public routes that don't require authentication
  const publicRoutes = [
    "/",
    "/courses",
    "/cart",
    "/blog",
    "/login",
    "/reset-password",
    "/auth/callback",
    "/payment",
    "/checkout",
    "/about",
    "/privacy-policy",
    "/terms-and-conditions",
    "/investor",
    "/api/webhooks", // Webhook endpoints are public
  ];
  const isPublicRoute = publicRoutes.some(
    (route) =>
      request.nextUrl.pathname === route ||
      request.nextUrl.pathname.startsWith(`${route}/`)
  );

  // Only check auth for protected routes
  if (!isPublicRoute) {
    return await updateSession(request);
  }

  // Still update session for public routes (to refresh tokens)
  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - Static assets (images, fonts, etc.)
     * 
     * Performance: Excluding more file types reduces middleware overhead
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|woff|woff2|ttf|eot|pdf|mp4|mp3)$).*)",
  ],
};
