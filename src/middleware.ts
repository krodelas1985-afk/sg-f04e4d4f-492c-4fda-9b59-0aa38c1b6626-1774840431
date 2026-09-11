import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Public routes that don't require authentication
const publicRoutes = [
  "/login",
  "/auth/set-password",
  "/privacy",
  "/api/webhooks/messenger",
  "/api/webhooks/lead-intake",
];

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          request.cookies.set({
            name,
            value,
            ...options,
          });
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          });
          response.cookies.set({
            name,
            value,
            ...options,
          });
        },
        remove(name: string, options: CookieOptions) {
          request.cookies.set({
            name,
            value: "",
            ...options,
          });
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          });
          response.cookies.set({
            name,
            value: "",
            ...options,
          });
        },
      },
    }
  );

  // getUser(), not getSession(): the cookie-borne session is not signature
  // verified, so it can be forged. This gate decides admin-route access, so it
  // has to validate the JWT against the Auth server.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  // Allow access to login page and API routes
  if (publicRoutes.includes(pathname) || pathname.startsWith("/api/")) {
    // If user is already authenticated and tries to access /login, redirect to appropriate home
    if (user && pathname === "/login") {
      // Don't fetch role here - let the login page handle the redirect
      // Just redirect to dashboard as default, login page will re-redirect if needed
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
    return response;
  }

  // Require authentication for all other routes
  if (!user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Admin route protection - fetch role to check access
  if (pathname.startsWith("/admin")) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    // If not baymo_admin, redirect to dashboard
    if (profile?.role !== "baymo_admin") {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
  }

  return response;
}

export const config = {
  matcher: [
    "/",
    "/login",
    "/dashboard/:path*",
    // Overview is where a client_admin's CRM opens. It was missing from this
    // list when it shipped, which left the page reachable signed out (the RPC
    // refused to return data, but the route itself was not gated).
    "/overview/:path*",
    "/leads/:path*",
    "/inbox/:path*",
    "/campaigns/:path*",
    "/tasks/:path*",
    "/users/:path*",
    "/settings/:path*",
    "/admin/:path*",
    // This matcher is an allowlist: a page not listed here never runs the
    // middleware, so it renders signed out. These signed-in pages were missing.
    // Deliberately NOT listed (public by design): /privacy, /auth/*,
    // /viewing-outcome and /viewing-confirm (the emailed token is the
    // authorisation), and /api/* (handled inside the middleware).
    "/sequences/:path*",
    "/templates/:path*",
    "/announcements/:path*",
    "/follow-up/:path*",
  ],
};