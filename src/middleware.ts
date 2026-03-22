import { NextRequest, NextResponse } from "next/server";

export async function middleware(req: NextRequest) {
  // Check for NextAuth session token cookie
  const token =
    req.cookies.get("next-auth.session-token")?.value ||
    req.cookies.get("__Secure-next-auth.session-token")?.value;

  if (!token) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("callbackUrl", req.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all paths except:
     * - /login
     * - /api/auth (NextAuth routes)
     * - /api/sync/webhook (Apify callback)
     * - /_next (static files)
     * - Static assets
     */
    "/((?!login|api/auth|api/sync/webhook|_next|favicon\\.ico|icon\\.png|fonts|oncourse-).*)",
  ],
};
