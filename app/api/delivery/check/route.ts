import { NextResponse } from "next/server";
import { getClientIp, limit, rateLimitResponse } from "@/lib/ratelimit";
import { checkDeliveryDistance } from "@/lib/goong";

export async function POST(request: Request) {
  try {
    const clientIp = getClientIp(request);
    const ipCheck = await limit("delivery_check", clientIp);
    if (!ipCheck.ok) {
      return rateLimitResponse(
        ipCheck.retryAfter,
        `Yêu cầu kiểm tra địa chỉ quá thường xuyên. Vui lòng thử lại sau ${ipCheck.retryAfter} giây.`
      );
    }

    let body: Record<string, unknown> = {};
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Định dạng JSON gửi lên không hợp lệ." },
        { status: 400 }
      );
    }

    const placeId = typeof body.placeId === "string" ? body.placeId.trim() : undefined;
    const address = typeof body.address === "string" ? body.address.trim() : undefined;
    const lat = typeof body.lat === "number" ? body.lat : undefined;
    const lng = typeof body.lng === "number" ? body.lng : undefined;

    if (!placeId && (lat === undefined || lng === undefined) && !address) {
      return NextResponse.json(
        { error: "Vui lòng cung cấp placeId, tọa độ (lat/lng) hoặc địa chỉ nhận hàng." },
        { status: 400 }
      );
    }

    const result = await checkDeliveryDistance({ placeId, lat, lng, address });
    return NextResponse.json(result);
  } catch (error) {
    console.error("[Delivery Check Error]", error);
    return NextResponse.json(
      {
        deliverable: false,
        distance_m: 0,
        duration_s: 0,
        reason: "Đã xảy ra lỗi khi kiểm tra phạm vi giao hàng.",
      },
      { status: 500 }
    );
  }
}
