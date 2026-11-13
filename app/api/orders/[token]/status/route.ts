import { NextResponse } from "next/server";
import { getOrderByPublicToken } from "@/lib/orders-db";
import { limit, rateLimitResponse } from "@/lib/ratelimit";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  if (!token || typeof token !== "string") {
    return NextResponse.json({ error: "Thiếu mã đơn hàng." }, { status: 400 });
  }

  // 1. Giới hạn tần suất: 60 lần / phút theo token
  const rateCheck = await limit("order_status", token);
  if (!rateCheck.ok) {
    return rateLimitResponse(
      rateCheck.retryAfter,
      `Yêu cầu kiểm tra trạng thái đơn hàng quá thường xuyên (tối đa 60 lần/phút). Vui lòng thử lại sau ${rateCheck.retryAfter} giây.`
    );
  }

  // 2. Tra cứu đơn hàng theo public_token
  const order = await getOrderByPublicToken(token);
  if (!order) {
    return NextResponse.json(
      { error: "Không tìm thấy đơn hàng." },
      { status: 404 }
    );
  }

  return NextResponse.json({
    ok: true,
    status: order.status,
    publicCode: order.public_code,
    paidAt: order.paid_at,
    cookingAt: order.cooking_at,
    packedAt: order.packed_at,
    deliveredAt: order.delivered_at,
    createdAt: order.created_at,
  });
}

