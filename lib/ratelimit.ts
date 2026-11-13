import "server-only";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { NextResponse } from "next/server";

export type RateLimitRule =
  | "orders_ip"
  | "orders_phone"
  | "admin_login"
  | "order_status"
  | "usda_search";

export interface RateLimitResult {
  ok: boolean;
  retryAfter: number; // Thời gian chờ (giây)
}

interface RuleConfig {
  limit: number;
  windowMs: number;
  upstashWindow: `${number} ${"s" | "m" | "h" | "d"}`;
  prefix: string;
}

const RULE_CONFIGS: Record<RateLimitRule, RuleConfig> = {
  orders_ip: {
    limit: 5,
    windowMs: 10 * 60 * 1000, // 10 phút
    upstashWindow: "10 m",
    prefix: "ratelimit:orders_ip",
  },
  orders_phone: {
    limit: 3,
    windowMs: 10 * 60 * 1000, // 10 phút
    upstashWindow: "10 m",
    prefix: "ratelimit:orders_phone",
  },
  admin_login: {
    limit: 5,
    windowMs: 15 * 60 * 1000, // 15 phút
    upstashWindow: "15 m",
    prefix: "ratelimit:admin_login",
  },
  order_status: {
    limit: 60,
    windowMs: 60 * 1000, // 1 phút
    upstashWindow: "1 m",
    prefix: "ratelimit:order_status",
  },
  usda_search: {
    limit: 30,
    windowMs: 60 * 1000, // 1 phút
    upstashWindow: "1 m",
    prefix: "ratelimit:usda_search",
  },
};

/**
 * Trích xuất địa chỉ IP của client từ headers
 * Ưu tiên lấy phần tử đầu tiên của header x-forwarded-for
 */
export function getClientIp(reqOrHeaders: Request | Headers): string {
  const headers = reqOrHeaders instanceof Request ? reqOrHeaders.headers : reqOrHeaders;
  const forwardedFor = headers.get("x-forwarded-for");
  if (forwardedFor) {
    const firstIp = forwardedFor.split(",")[0].trim();
    if (firstIp) return firstIp;
  }
  const realIp = headers.get("x-real-ip");
  if (realIp) return realIp.trim();
  return "127.0.0.1";
}

// Bộ nhớ in-memory dự phòng khi môi trường chưa cấu hình Redis
const inMemoryStore = new Map<string, number[]>();

function inMemoryLimit(rule: RateLimitRule, key: string): RateLimitResult {
  const config = RULE_CONFIGS[rule];
  const fullKey = `${config.prefix}:${key}`;
  const now = Date.now();
  const windowMs = config.windowMs;

  const existing = (inMemoryStore.get(fullKey) || []).filter(
    (timestamp) => now - timestamp < windowMs
  );

  if (existing.length >= config.limit) {
    const oldest = existing[0];
    const retryAfter = Math.max(1, Math.ceil((oldest + windowMs - now) / 1000));
    return { ok: false, retryAfter };
  }

  existing.push(now);
  inMemoryStore.set(fullKey, existing);
  return { ok: true, retryAfter: 0 };
}

/** Xóa cache in-memory cho mục đích test */
export function resetInMemoryRateLimits() {
  inMemoryStore.clear();
}

let redisClient: Redis | null = null;
const upstashLimiters = new Map<RateLimitRule, Ratelimit>();

function getUpstashLimiter(rule: RateLimitRule): Ratelimit | null {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;

  if (!redisClient) {
    redisClient = new Redis({ url, token });
  }

  if (!upstashLimiters.has(rule)) {
    const config = RULE_CONFIGS[rule];
    const limiter = new Ratelimit({
      redis: redisClient,
      limiter: Ratelimit.slidingWindow(config.limit, config.upstashWindow),
      prefix: config.prefix,
    });
    upstashLimiters.set(rule, limiter);
  }

  return upstashLimiters.get(rule) ?? null;
}

/**
 * Kiểm tra giới hạn tần suất (Rate Limiting)
 *
 * @param rule Quy tắc kiểm tra (orders_ip | orders_phone | admin_login | order_status | usda_search)
 * @param key Khóa định danh (IP, SĐT, token đơn hàng, hoặc phiên admin)
 * @returns { ok, retryAfter }
 */
export async function limit(
  rule: RateLimitRule,
  key: string
): Promise<RateLimitResult> {
  const limiter = getUpstashLimiter(rule);

  // Nếu không cấu hình Upstash Redis, sử dụng in-memory limiter dự phòng
  if (!limiter) {
    return inMemoryLimit(rule, key);
  }

  try {
    const res = await limiter.limit(key);
    if (!res.success) {
      const retryAfter = Math.max(1, Math.ceil((res.reset - Date.now()) / 1000));
      return { ok: false, retryAfter };
    }
    return { ok: true, retryAfter: 0 };
  } catch (err) {
    // Xử lý khi Redis không phản hồi hoặc gặp lỗi mạng
    if (rule === "admin_login") {
      // Đăng nhập admin: Chặn để bảo đảm an toàn (Fail-closed)
      console.error(
        "[RateLimit] Upstash Redis lỗi/không phản hồi cho 'admin_login' (Fail-closed: chặn đăng nhập):",
        err
      );
      return { ok: false, retryAfter: 60 };
    }

    // Các API khác: Cho qua và ghi nhận cảnh báo (Fail-open)
    console.warn(
      `[RateLimit] Upstash Redis không phản hồi cho rule '${rule}' (Fail-open: cho phép request):`,
      err instanceof Error ? err.message : err
    );
    return { ok: true, retryAfter: 0 };
  }
}

/**
 * Trả về HTTP Response 429 Too Many Requests theo chuẩn
 */
export function rateLimitResponse(
  retryAfter: number,
  customMessage?: string
): NextResponse {
  const seconds = Math.max(1, Math.ceil(retryAfter));
  const message =
    customMessage ||
    `Bạn đã gửi quá nhiều yêu cầu. Vui lòng thử lại sau ${seconds} giây.`;

  return NextResponse.json(
    {
      error: message,
      retryAfter: seconds,
    },
    {
      status: 429,
      headers: {
        "Retry-After": String(seconds),
      },
    }
  );
}

