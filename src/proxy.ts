import { NextResponse, type NextRequest } from "next/server";

// Optimistic check only: no session cookie → send to sign-in. Whether the
// session is valid (and the user still allowlisted) is checked by
// requireUser() in src/server/auth-guard.ts.
const SESSION_COOKIES = ["authjs.session-token", "__Secure-authjs.session-token"];

export function proxy(request: NextRequest) {
  const hasSession = SESSION_COOKIES.some((name) => request.cookies.has(name));
  if (hasSession) return NextResponse.next();

  const url = new URL("/signin", request.url);
  const { pathname, search } = request.nextUrl;
  if (pathname !== "/") url.searchParams.set("callbackUrl", pathname + search);
  return NextResponse.redirect(url);
}

export const config = {
  // Everything except sign-in, auth/health APIs, Next internals and static files.
  matcher: ["/((?!signin|api/auth|api/health|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
