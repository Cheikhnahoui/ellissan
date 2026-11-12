import { NextResponse, type NextRequest } from "next/server";

/**
 * Cheap first gate: no session cookie -> /login. This is NOT authorization.
 * Real validation (DB session lookup) happens server-side in requireAdmin() on every page, action and route.
 */
export function proxy(req: NextRequest) {
  if (!req.cookies.has("lisan_session")) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!login|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|ico|txt)$).*)"],
};
