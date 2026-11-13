import "server-only";
import crypto from "node:crypto";
import { cookies } from "next/headers";

const SESSION_COOKIE_NAME = "mhln_admin_session";
const SESSION_TTL_SECONDS = 12 * 60 * 60; // 12 giờ

function getSessionSecret(): string {
  const secret = process.env.ADMIN_SESSION_SECRET || process.env.ADMIN_PASSCODE;
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("Lỗi bảo mật: Chưa cấu hình ADMIN_SESSION_SECRET trên môi trường production.");
    }
    return "mhln_dev_insecure_fallback_session_secret_2026";
  }
  return secret;
}

/**
 * Ký session token bằng HMAC-SHA256
 */
export function signSessionToken(payload: { exp: number; role?: string }): string {
  const secret = getSessionSecret();
  const data = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = crypto.createHmac("sha256", secret).update(data).digest("base64url");
  return `${data}.${signature}`;
}

/**
 * Kiểm tra tính hợp lệ và thời hạn của session token (so sánh chữ ký bằng timingSafeEqual)
 */
export function verifySessionToken(token: string | undefined): boolean {
  if (!token || typeof token !== "string") return false;
  const parts = token.split(".");
  if (parts.length !== 2) return false;

  const [data, signature] = parts;
  if (!data || !signature) return false;

  const secret = getSessionSecret();
  const expectedSig = crypto.createHmac("sha256", secret).update(data).digest("base64url");

  const sigBuf = Buffer.from(signature, "utf8");
  const expectedBuf = Buffer.from(expectedSig, "utf8");

  if (sigBuf.length !== expectedBuf.length) {
    crypto.timingSafeEqual(sigBuf, sigBuf);
    return false;
  }

  if (!crypto.timingSafeEqual(sigBuf, expectedBuf)) {
    return false;
  }

  try {
    const raw = Buffer.from(data, "base64url").toString("utf8");
    const payload = JSON.parse(raw);
    if (typeof payload.exp !== "number" || payload.exp < Date.now()) {
      return false; // Hết hạn 12 giờ
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * So sánh passcode quản trị viên an toàn chống timing attacks
 */
export function verifyAdminPasscode(inputPasscode: string): boolean {
  const configured = process.env.ADMIN_PASSCODE;
  if (!configured || typeof inputPasscode !== "string") return false;

  const expectedBuf = Buffer.from(configured, "utf8");
  const actualBuf = Buffer.from(inputPasscode, "utf8");

  if (expectedBuf.length !== actualBuf.length) {
    // Chạy timingSafeEqual giả lập cùng kích thước để tránh timing leak qua độ dài
    crypto.timingSafeEqual(actualBuf, actualBuf);
    return false;
  }

  return crypto.timingSafeEqual(expectedBuf, actualBuf);
}

/**
 * Thiết lập cookie phiên quản trị viên (HMAC, httpOnly, secure, sameSite=strict, 12h)
 */
export async function setAdminSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  const token = signSessionToken({
    exp: Date.now() + SESSION_TTL_SECONDS * 1000,
    role: "admin",
  });

  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: SESSION_TTL_SECONDS,
    path: "/",
  });
}

/**
 * Xóa cookie phiên khi đăng xuất
 */
export async function clearAdminSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
  // Xóa cả cookie cũ nếu có
  cookieStore.delete("mhln_admin");
}

/**
 * Kiểm tra trạng thái đăng nhập admin hiện tại
 */
export async function isAdmin(): Promise<boolean> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  return verifySessionToken(token);
}

export class AdminUnauthorizedError extends Error {
  status = 401;
  constructor(message = "Không có quyền truy cập quản trị viên. Yêu cầu đăng nhập.") {
    super(message);
    this.name = "AdminUnauthorizedError";
  }
}

/**
 * Hàm kiểm tra quyền bắt buộc trong MỌI route handler và server action thuộc admin.
 * Ném ra AdminUnauthorizedError nếu phiên không hợp lệ hoặc đã hết hạn.
 */
export async function requireAdmin(): Promise<void> {
  const authorized = await isAdmin();
  if (!authorized) {
    throw new AdminUnauthorizedError();
  }
}
