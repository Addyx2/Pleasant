import { NextResponse, type NextRequest } from "next/server";

import { SESSION_COOKIE } from "./lib/constants";

const PROTECTED_PREFIXES = ["/dashboard", "/shifts", "/timesheets", "/staff", "/clients", "/payroll", "/workforce"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isProtected = PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );

  if (isProtected && !request.cookies.get(SESSION_COOKIE)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/shifts/:path*", "/timesheets/:path*", "/staff/:path*", "/clients/:path*", "/payroll/:path*", "/workforce/:path*"],
};
