import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PROTECTED = [
  "/calendar",
  "/map",
  "/e/new",
  "/e/",
  "/g/",
  "/me",
  "/settings",
  "/reports",
  "/notifications",
  "/onboarding",
];

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (pathname.startsWith("/api/") || pathname.startsWith("/_next/") || pathname === "/") {
    return NextResponse.next();
  }
  if (!PROTECTED.some((p) => pathname.startsWith(p))) return NextResponse.next();

  const sessionCookie =
    req.cookies.get("authjs.session-token")?.value ??
    req.cookies.get("__Secure-authjs.session-token")?.value;
  if (sessionCookie) return NextResponse.next();

  const url = new URL("/login", req.url);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
