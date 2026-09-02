import { NextRequest, NextResponse } from "next/server";
import { isValidSessionCookie, SESSION_COOKIE_NAME } from "@/lib/session";

const PUBLIC_PATHS = new Set([
  "/login",
  "/offline",
  "/api/login",
  "/api/verify-2fa",
  // Invoked by Vercel Cron, which can't carry the session cookie — the route
  // itself checks the Authorization: Bearer <CRON_SECRET> header Vercel adds
  // automatically, so this doesn't weaken the app's actual auth.
  "/api/cron/daily-digest",
]);
// The service worker must be fetchable without a session (see the matcher
// below, which also excludes it).

// A per-request nonce lets us run a strict Content-Security-Policy
// (`script-src` with no `'unsafe-inline'`) while still allowing Next's inline
// bootstrap scripts and our one inline theme script — Next reads the CSP from
// the request headers we set here and stamps the nonce onto its own tags;
// layout.tsx puts it on the theme script.
function buildCsp(nonce: string): string {
  const isDev = process.env.NODE_ENV === "development";
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' blob: data:",
    "font-src 'self'",
    "connect-src 'self'",
    // Explicit so the service worker registration isn't caught by the
    // 'strict-dynamic' in script-src (which disables 'self' for scripts).
    "worker-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "upgrade-insecure-requests",
  ].join("; ");
}

export async function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const csp = buildCsp(nonce);

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("content-security-policy", csp);

  const pass = () => {
    const res = NextResponse.next({ request: { headers: requestHeaders } });
    res.headers.set("Content-Security-Policy", csp);
    return res;
  };
  const stop = (res: NextResponse) => {
    res.headers.set("Content-Security-Policy", csp);
    return res;
  };

  const { pathname } = request.nextUrl;
  if (PUBLIC_PATHS.has(pathname)) {
    return pass();
  }

  const cookie = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (await isValidSessionCookie(cookie)) {
    return pass();
  }

  // API calls get a 401 they can handle in place; page navigations redirect
  // to the login screen.
  if (pathname.startsWith("/api/")) {
    return stop(NextResponse.json({ error: "Unauthorized" }, { status: 401 }));
  }
  const url = request.nextUrl.clone();
  url.pathname = "/login";
  url.search = "";
  return stop(NextResponse.redirect(url));
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icon|apple-icon|manifest.webmanifest|sw.js).*)",
  ],
};
