import { NextResponse } from "next/server";
import { getClientIp, limit, rateLimitResponse } from "@/lib/ratelimit";
import {
  getOrderByCode,
  getOrderByPublicToken,
  getOrdersByPhone,
} from "@/lib/orders-db";
import type { OrderRecord } from "@/lib/types";
import { orderLookupSchema, formatZodError, VN_PHONE_REGEX } from "@/lib/validations";
import { getCustomerOrderLabel } from "@/lib/order-labels";

function maskPhone(phone: string): string {
  const clean = phone.replace(/[\s.-]/g, "");
  if (clean.length >= 10) {
    return clean.slice(0, 3) + "****" + clean.slice(-3);
  }
  return clean.slice(0, 2) + "****" + clean.slice(-2);
}

function maskName(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length <= 1) return name.slice(0, 1) + "***";
  return parts[0] + " " + "*".repeat(parts.slice(1).join(" ").length);
}

function maskAddress(addr: string): string {
  const parts = addr.split(",");
  if (parts.length > 1) {
    return "***, " + parts.slice(1).map((p) => p.trim()).join(", ");
  }
  return addr.slice(0, 3) + "***";
}

function formatCustomerOrder(order: OrderRecord) {
  return {
    publicToken: order.public_token,
    publicCode: order.public_code,
    status: order.status,
    statusLabel: getCustomerOrderLabel(order.status),
    customerName: maskName(order.customer_name),
    phone: maskPhone(order.phone),
    deliveryAddress: maskAddress(order.delivery_address),
    totalVnd: order.total_vnd,
    createdAt: order.created_at,
    expiresAt: order.expires_at,
    itemsCount: order.items.length,
    itemSummary: order.items.map((i: { name: string; grams: number }) => `${i.name} (${i.grams}g)`).join(", "),
    trackingUrl: `/orders/${order.public_token}`,
    paymentUrl: `/payment/${order.public_token}`,
  };
}

export async function POST(request: Request) {
  try {
    const clientIp = getClientIp(request);
    const ipCheck = await limit("orders_lookup", clientIp);
    if (!ipCheck.ok) {
      return rateLimitResponse(
        ipCheck.retryAfter,
        `Bạn đã tra cứu quá nhiều lần. Vui lòng thử lại sau ${ipCheck.retryAfter} giây.`
      );
    }

    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Định dạng JSON gửi lên không hợp lệ." },
        { status: 400 }
      );
    }

    const validation = orderLookupSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: formatZodError(validation.error) },
        { status: 400 }
      );
    }

    const rawQuery = validation.data.query.trim();
    const cleanDigits = rawQuery.replace(/[\s.-]/g, "");

    let orders: OrderRecord[] = [];

    // 1. Nếu nhập số điện thoại Việt Nam
    if (VN_PHONE_REGEX.test(cleanDigits) || (cleanDigits.length >= 9 && cleanDigits.startsWith("0"))) {
      orders = await getOrdersByPhone(cleanDigits);
    }
    // 2. Nếu nhập mã đơn hàng MHLN...
    else if (rawQuery.toUpperCase().startsWith("MHLN")) {
      const order = await getOrderByCode(rawQuery.toUpperCase());
      if (order) orders = [order];
    }
    // 3. Nếu nhập mã token nanoid (21 ký tự)
    else if (rawQuery.length >= 20) {
      const order = await getOrderByPublicToken(rawQuery);
      if (order) orders = [order];
    }
    // 4. Fallback: Thử tra theo mã đơn hoặc token
    else {
      const byCode = await getOrderByCode(rawQuery.toUpperCase());
      if (byCode) {
        orders = [byCode];
      } else {
        const byPhone = await getOrdersByPhone(cleanDigits);
        if (byPhone.length > 0) orders = byPhone;
      }
    }

    return NextResponse.json({
      orders: orders.map(formatCustomerOrder),
      count: orders.length,
    });
  } catch (error) {
    console.error("[Order Lookup Error]", error);
    return NextResponse.json(
      { error: "Có lỗi xảy ra khi tra cứu đơn hàng." },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("query") || searchParams.get("q") || "";
  const mockReq = new Request(request.url, {
    method: "POST",
    headers: request.headers,
    body: JSON.stringify({ query }),
  });
  return POST(mockReq);
}
