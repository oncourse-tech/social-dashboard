import { getToken } from "next-auth/jwt";
import { NextRequest, NextResponse } from "next/server";

const PUBLIC_PATHS = [
  "/login",
  "/api/auth",
  "/api/sync/webhook",
  "/_next",
  "/favicon.ico",
  "/icon.png",
  "/oncourse-logo.svg",
  "/oncourse-logo-with-name.webp",
  "/oncourse-icon.png",
  "/fonts",
];

function isPublic(pathname: string) {
  return PUBLIC_PATHS.some(
    (p) => pathname === p || pathname.startsWith(p + "/")
  );
}

export async function middleware(req: NextRequest) {
  if (isPublic(req.nextUrl.pathname)) {
    return NextResponse.next();
  }

  const token = await getToken({ req });

  if (!token) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("callbackUrl", req.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
