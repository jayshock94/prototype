/**
 * Gatekeeper for the admin area.
 *
 * Runs before any /admin page renders. No valid session cookie means a redirect
 * to the login page, with the originally requested path remembered so the login
 * form can send you back there afterwards.
 *
 * Doing this in middleware rather than in each page means a new admin page
 * added in a later chunk is protected automatically -- there is no way to
 * forget the check.
 *
 * THIS FILE MUST STAY AT src/middleware.ts. Next.js looks for middleware in
 * exactly one place: next to the `app` directory. Because this project keeps
 * `app` under `src/`, a middleware file at the repository root is silently
 * ignored -- no error, no warning, and every admin page served to anyone who
 * knows the URL. It sat at the root until this was noticed. If you move it,
 * check that /admin redirects to /admin/login in a browser with no cookies.
 */

import { NextResponse, type NextRequest } from "next/server";

import { ADMIN_COOKIE, verifySessionToken } from "@/lib/auth";

export async function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  // The login page itself must stay reachable, or there would be no way in.
  if (pathname === "/admin/login") {
    return NextResponse.next();
  }

  const token = request.cookies.get(ADMIN_COOKIE)?.value;
  if (await verifySessionToken(token)) {
    return NextResponse.next();
  }

  const loginUrl = new URL("/admin/login", request.url);
  loginUrl.searchParams.set("next", `${pathname}${search}`);

  const response = NextResponse.redirect(loginUrl);
  // Clear an expired or tampered cookie so the browser stops sending it.
  if (token) response.cookies.delete(ADMIN_COOKIE);
  return response;
}

export const config = {
  // Only /admin routes. The reviewer side (/r) and prototype serving (/p),
  // built in later chunks, have their own separate password check.
  matcher: ["/admin/:path*"],
};
