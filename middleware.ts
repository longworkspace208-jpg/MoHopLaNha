import { NextRequest, NextResponse } from "next/server";

export function middleware(request: NextRequest) {
  if (request.nextUrl.pathname === "/admin/login") return NextResponse.next();
  const passcode = process.env.ADMIN_PASSCODE;
  if (!passcode || request.cookies.get("mhln_admin")?.value !== passcode) {
    return NextResponse.redirect(new URL("/admin/login", request.url));
  }
  return NextResponse.next();
}

export const config = { matcher: ["/admin/:path*"] };
