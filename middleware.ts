import { NextRequest, NextResponse } from "next/server";

// Protect the admin console and admin APIs with a cookie token. Read-only public
// pages and the prediction APIs stay open.
const ADMIN_TOKEN = process.env.ADMIN_TOKEN ?? "dev-admin";

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const authed = req.cookies.get("admin_token")?.value === ADMIN_TOKEN;

  if (pathname.startsWith("/admin/login")) return NextResponse.next();

  if (pathname.startsWith("/api/admin")) {
    if (!authed) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    return NextResponse.next();
  }

  if (pathname.startsWith("/admin")) {
    if (!authed) {
      const url = req.nextUrl.clone();
      url.pathname = "/admin/login";
      return NextResponse.redirect(url);
    }
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*"],
};
