import { NextRequest, NextResponse } from "next/server";

const SESSION_COOKIE_NAME = "mhln_admin_session";

async function verifyEdgeToken(token: string, secret: string): Promise<boolean> {
  try {
    const parts = token.split(".");
    if (parts.length !== 2) return false;
    const [data, signature] = parts;
    if (!data || !signature) return false;

    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      enc.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"]
    );

    let base64 = signature.replace(/-/g, "+").replace(/_/g, "/");
    while (base64.length % 4) base64 += "=";
    const sigBytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));

    const valid = await crypto.subtle.verify(
      "HMAC",
      key,
      sigBytes,
      enc.encode(data)
    );

    if (!valid) return false;

    let payloadStr = data.replace(/-/g, "+").replace(/_/g, "/");
    while (payloadStr.length % 4) payloadStr += "=";
    const payload = JSON.parse(atob(payloadStr));
    return typeof payload.exp === "number" && payload.exp > Date.now();
  } catch {
    return false;
  }
}

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // Cho phép trang đăng nhập admin
  if (pathname === "/admin/login") {
    return NextResponse.next();
  }

  const secret =
    process.env.ADMIN_SESSION_SECRET ||
    process.env.ADMIN_PASSCODE ||
    "mhln_dev_insecure_fallback_session_secret_2026";

  const sessionToken = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const isAuthorized = sessionToken ? await verifyEdgeToken(sessionToken, secret) : false;

  if (!isAuthorized) {
    // Nếu là API admin, trả về 401 Unauthorized
    if (pathname.startsWith("/api/admin")) {
      return NextResponse.json(
        { error: "Không có quyền truy cập quản trị viên. Yêu cầu đăng nhập." },
        { status: 401 }
      );
    }
    // Nếu là trang web admin, chuyển hướng sang trang login
    const loginUrl = new URL("/admin/login", request.url);
    loginUrl.searchParams.set("from", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*"],
};
