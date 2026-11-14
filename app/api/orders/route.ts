import { NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { isAdmin } from "@/lib/admin-auth";
import {
  createOrderInDb,
  countAwaitingOrdersByPhone,
  OutOfStockError,
  type OrderCreationItem,
} from "@/lib/orders-db";
import { validateServiceArea } from "@/lib/delivery-config";
import { orderCreationSchema, formatZodError } from "@/lib/validations";
import { getClientIp, limit, rateLimitResponse } from "@/lib/ratelimit";
import { verifyTurnstileToken } from "@/lib/turnstile";

export async function POST(request: Request) {
  try {
    // 1. Giới hạn tần suất tạo đơn theo IP: 5 lần / 10 phút
    const clientIp = getClientIp(request);
    const ipCheck = await limit("orders_ip", clientIp);
    if (!ipCheck.ok) {
      return rateLimitResponse(
        ipCheck.retryAfter,
        `Bạn đã gửi quá nhiều yêu cầu tạo đơn từ địa chỉ này (tối đa 5 lần/10 phút). Vui lòng thử lại sau ${ipCheck.retryAfter} giây.`
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

    // Chuẩn hóa danh sách món từ items hoặc lines
    const rawItems = Array.isArray(body.items)
      ? body.items
      : Array.isArray(body.lines)
        ? body.lines
        : [];

    const normalizedItems: OrderCreationItem[] = rawItems.map((raw: Record<string, unknown>) => {
      const dishId = String(
        raw.dishId ?? raw.dish_id ?? (raw.dish as { id?: string })?.id ?? ""
      ).trim();
      const grams = Number(raw.grams ?? (Number(raw.quantity ?? 1) * 350));
      return { dishId, grams };
    });

    const normalizedBody = {
      customerName: String(body.customerName ?? "").trim(),
      phone: String(body.phone ?? "").trim(),
      address: String(body.address ?? body.deliveryAddress ?? "").trim(),
      deliveryAddress: String(body.deliveryAddress ?? body.address ?? "").trim(),
      email: String(body.email ?? body.customerEmail ?? "").trim() || undefined,
      customerEmail: String(body.customerEmail ?? body.email ?? "").trim() || undefined,
      note: String(body.note ?? "").trim() || undefined,
      source: String(body.source ?? "").trim() || undefined,
      overrideArea: Boolean(body.overrideArea),
      people: body.people !== undefined ? Number(body.people) : undefined,
      goal: body.goal !== undefined ? String(body.goal).trim() : undefined,
      items: normalizedItems,
    };

    // 2. Xác thực cấu trúc dữ liệu bằng Zod
    const validationResult = orderCreationSchema.safeParse(normalizedBody);
    if (!validationResult.success) {
      return NextResponse.json(
        { error: formatZodError(validationResult.error) },
        { status: 400 }
      );
    }

    const validData = validationResult.data;

    // 3. Giới hạn tần suất tạo đơn theo SĐT: 3 lần / 10 phút
    const phoneCheck = await limit("orders_phone", validData.phone);
    if (!phoneCheck.ok) {
      return rateLimitResponse(
        phoneCheck.retryAfter,
        `Số điện thoại này đã tạo đơn quá nhiều lần (tối đa 3 lần/10 phút). Vui lòng thử lại sau ${phoneCheck.retryAfter} giây.`
      );
    }

    // 4. Giới hạn nghiệp vụ: mỗi SĐT tối đa 3 đơn awaiting_payment cùng lúc
    const awaitingCount = await countAwaitingOrdersByPhone(validData.phone);
    if (awaitingCount >= 3) {
      return NextResponse.json(
        {
          error:
            "Số điện thoại này hiện đã có 3 đơn hàng đang chờ thanh toán. Vui lòng thanh toán hoặc hoàn tất các đơn trước khi đặt thêm đơn mới.",
          code: "TOO_MANY_AWAITING_ORDERS",
        },
        { status: 409 }
      );
    }

    // 5. Xác minh chống bot Cloudflare Turnstile (ngoại trừ admin tạo đơn thủ công)
    const isFacebookAdmin = validData.source === "facebook" && (await isAdmin());
    if (!isFacebookAdmin) {
      const turnstileToken =
        typeof body.turnstileToken === "string" ? body.turnstileToken : undefined;
      const turnstileResult = await verifyTurnstileToken(turnstileToken, clientIp);
      if (!turnstileResult.success) {
        return NextResponse.json(
          {
            error:
              turnstileResult.error ||
              "Xác minh chống bot (Cloudflare Turnstile) không thành công. Vui lòng thử lại.",
            code: "TURNSTILE_FAILED",
          },
          { status: 400 }
        );
      }
    }

    // 6. Kiểm tra địa chỉ thuộc vùng giao hàng (ngoại trừ admin Facebook override)
    const allowOverride =
      validData.source === "facebook" &&
      validData.overrideArea === true &&
      (await isAdmin());

    if (!allowOverride) {
      const addressCheck = validateServiceArea(validData.address);
      if (!addressCheck.inService) {
        return NextResponse.json(
          { error: addressCheck.message ?? "Địa chỉ nằm ngoài vùng phục vụ." },
          { status: 400 }
        );
      }
    }

    const note =
      validData.source === "facebook"
        ? validData.note?.startsWith("Đơn Facebook:")
          ? validData.note
          : validData.note
            ? `Đơn Facebook: ${validData.note}`
            : "Đơn Facebook"
        : validData.note || null;

    // 7. Tạo public_token nanoid(21) bảo mật cao, không đoán được
    const publicToken = nanoid(21);

    // 8. Tạo đơn hàng trong DB
    const result = await createOrderInDb({
      customerName: validData.customerName,
      phone: validData.phone,
      deliveryAddress: validData.address,
      customerEmail: validData.email || null,
      note,
      items: validData.items,
      publicToken,
      people: validData.people,
      goal: validData.goal,
    });

    // Log bảo mật: tuyệt đối KHÔNG ghi SĐT, email hay địa chỉ vào log
    console.info(`[Order Created] ID: ${result.orderId} · Mã tra cứu: ${result.publicCode}`);

    return NextResponse.json({
      orderId: result.orderId,
      publicCode: result.publicCode,
      publicToken: result.publicToken,
      paymentUrl: `/payment/${result.publicToken}`,
      orderUrl: `/orders/${result.publicToken}`,
    });
  } catch (error) {
    if (error instanceof OutOfStockError) {
      return NextResponse.json(
        { error: error.message, code: "DISH_OUT_OF_STOCK" },
        { status: 409 }
      );
    }

    // Log lỗi không kèm PII khách hàng
    console.error("[Order Error]", error instanceof Error ? error.message : "Lỗi không xác định");

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Có lỗi xảy ra khi tạo đơn hàng. Vui lòng thử lại.",
      },
      { status: 400 }
    );
  }
}
