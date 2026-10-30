import { NextResponse, type NextRequest } from "next/server";

import { SESSION_COOKIE } from "./lib/constants";

const PROTECTED_PREFIXES = [
  "/dashboard",
  "/oversight",
  "/shifts",
  "/timesheets",
  "/staff",
  "/clients",
  "/payroll",
  "/workforce",
  "/dispatch",
  "/rota",
  "/compliance",
  "/import",
  "/billing",
  "/billing-pack",
  "/invoice",
  "/settings",
  "/addons",
  "/persona",
  "/assist",
];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Calls from Aultrum (the Aultrum app, Workspace Supply) carry a request id,
  // logged at both ends and sent back, so one failed tap can be traced.
  if (pathname.startsWith("/api/carer/") || pathname.startsWith("/api/supply/")) {
    const requestId = request.headers.get("x-request-id")?.slice(0, 64) || crypto.randomUUID();
    console.log(JSON.stringify({ event: "aultrum_api", requestId, method: request.method, path: pathname }));
    const response = NextResponse.next();
    response.headers.set("x-request-id", requestId);
    return response;
  }
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
  matcher: [
    "/api/carer/:path*",
    "/api/supply/:path*",
    "/dashboard/:path*",
    "/oversight/:path*",
    "/shifts/:path*",
    "/timesheets/:path*",
    "/staff/:path*",
    "/clients/:path*",
    "/payroll/:path*",
    "/workforce/:path*",
    "/dispatch/:path*",
    "/rota/:path*",
    "/compliance/:path*",
    "/import/:path*",
    "/billing/:path*",
    "/billing-pack/:path*",
    "/invoice/:path*",
    "/settings/:path*",
    "/addons/:path*",
    "/persona/:path*",
    "/assist/:path*",
  ],
};
