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

  const {
    data: { session },
  } = await supabase.auth.getSession();

  const { pathname } = request.nextUrl;

  // Allow access to login page and API routes
  if (publicRoutes.includes(pathname) || pathname.startsWith("/api/")) {
    // If user is already authenticated and tries to access /login, redirect to appropriate home
    if (session && pathname === "/login") {
      // Don't fetch role here - let the login page handle the redirect
      // Just redirect to dashboard as default, login page will re-redirect if needed
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
    return response;
  }

  // Require authentication for all other routes
  if (!session) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Admin route protection - fetch role to check access
  if (pathname.startsWith("/admin")) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", session.user.id)
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
    "/leads/:path*",
    "/inbox/:path*",
    "/campaigns/:path*",
    "/tasks/:path*",
    "/users/:path*",
    "/settings/:path*",
    "/admin/:path*",
  ],
};