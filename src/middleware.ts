import { createMiddlewareClient } from "@supabase/auth-helpers-nextjs";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();
  const supabase = createMiddlewareClient({ req, res });

  const {
    data: { session },
  } = await supabase.auth.getSession();

  const isAuthPage = req.nextUrl.pathname === "/login";
  const isAdminRoute = req.nextUrl.pathname.startsWith("/admin");

  if (!session && !isAuthPage) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  if (session) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", session.user.id)
      .single();

    if (isAuthPage) {
      const redirectTo = profile?.role === "baymo_admin" ? "/admin" : "/dashboard";
      return NextResponse.redirect(new URL(redirectTo, req.url));
    }

    if (isAdminRoute && profile?.role !== "baymo_admin") {
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }
  }

  return res;
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