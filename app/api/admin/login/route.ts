import { NextResponse } from "next/server";
import { verifyAdminPasscode, setAdminSessionCookie } from "@/lib/admin-auth";
import { getClientIp, limit, rateLimitResponse } from "@/lib/ratelimit";

export async function POST(request: Request) {
  const clientIp = getClientIp(request);

  // 1. Kiểm tra giới hạn đăng nhập admin: 5 lần / 15 phút theo IP
  const ipCheck = await limit("admin_login", clientIp);
  if (!ipCheck.ok) {
    return rateLimitResponse(
      ipCheck.retryAfter,
      `Bạn đã thử đăng nhập quá số lần cho phép (5 lần/15 phút). Vui lòng thử lại sau ${ipCheck.retryAfter} giây.`
    );
  }

  let body: Record<string, unknown> = {};
  try {
    body = await request.json();
  } catch {
    // Cho phép form-data hoặc empty body
  }

  const token = String(body.token ?? body.passcode ?? "").trim();
  if (!process.env.ADMIN_PASSCODE) {
    return NextResponse.json(
      { error: "Biến môi trường ADMIN_PASSCODE chưa được cấu hình trên server." },
      { status: 500 }
    );
  }

  if (!verifyAdminPasscode(token)) {
    return NextResponse.json(
      { error: "Mã truy cập không đúng. Vui lòng thử lại." },
      { status: 401 }
    );
  }

  await setAdminSessionCookie();
  return NextResponse.json({ ok: true, message: "Đăng nhập thành công." });
}

