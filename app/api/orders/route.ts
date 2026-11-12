import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-auth";
import { createOrderInDb, OutOfStockError, type OrderCreationItem } from "@/lib/orders-db";
import { validateServiceArea } from "@/lib/delivery-config";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const customerName = String(body.customerName ?? "").trim();
    const phone = String(body.phone ?? "").trim();
    const address = String(body.address ?? body.deliveryAddress ?? "").trim();
    const email = String(body.email ?? body.customerEmail ?? "").trim() || null;
    const source = String(body.source ?? "").trim();
    const rawNote = String(body.note ?? "").trim();
    const note =
      source === "facebook"
        ? rawNote.startsWith("Đơn Facebook:")
          ? rawNote
          : rawNote
            ? `Đơn Facebook: ${rawNote}`
            : "Đơn Facebook"
        : rawNote || null;

    if (!customerName) {
      return NextResponse.json({ error: "Vui lòng nhập họ và tên người nhận." }, { status: 400 });
    }
    if (!phone) {
      return NextResponse.json({ error: "Vui lòng nhập số điện thoại người nhận." }, { status: 400 });
    }
    if (!address) {
      return NextResponse.json({ error: "Vui lòng nhập địa chỉ nhận hàng." }, { status: 400 });
    }

    // 1. Kiểm tra địa chỉ thuộc vùng phục vụ từ config (admin Facebook order có thể overrideArea)
    const allowOverride = source === "facebook" && body.overrideArea === true && (await isAdmin());
    if (!allowOverride) {
      const addressCheck = validateServiceArea(address);
      if (!addressCheck.inService) {
        return NextResponse.json(
          { error: addressCheck.message ?? "Địa chỉ nằm ngoài vùng phục vụ." },
          { status: 400 }
        );
      }
    }

    // 2. Chuẩn hóa danh sách món ăn & gram
    const rawItems = Array.isArray(body.items) ? body.items : Array.isArray(body.lines) ? body.lines : [];
    if (!rawItems.length) {
      return NextResponse.json({ error: "Giỏ hàng không có món nào để đặt." }, { status: 400 });
    }

    const items: OrderCreationItem[] = rawItems.map((raw: Record<string, unknown>) => {
      const dishId = String(raw.dishId ?? raw.dish_id ?? (raw.dish as { id?: string })?.id ?? "");
      const grams = Number(raw.grams ?? (Number(raw.quantity ?? 1) * 350));
      return { dishId, grams };
    });

    if (items.some((i) => !i.dishId || !Number.isFinite(i.grams) || i.grams <= 0)) {
      return NextResponse.json(
        { error: "Thông tin món ăn hoặc định lượng gram không hợp lệ." },
        { status: 400 }
      );
    }

    // 3. Server tính lại giá và dinh dưỡng từ DB, tạo mã MHLN####, order_items snapshot, status='awaiting_payment'
    const result = await createOrderInDb({
      customerName,
      phone,
      deliveryAddress: address,
      customerEmail: email,
      note,
      items
    });

    return NextResponse.json({
      orderId: result.orderId,
      publicCode: result.publicCode
    });
  } catch (error) {
    if (error instanceof OutOfStockError) {
      return NextResponse.json(
        { error: error.message, code: "DISH_OUT_OF_STOCK" },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Có lỗi xảy ra khi tạo đơn hàng." },
      { status: 500 }
    );
  }
}
