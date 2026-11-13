import { NextResponse } from "next/server";
import { requireAdmin, AdminUnauthorizedError } from "@/lib/admin-auth";
import { getOrderById, updateOrderStatusWithTimestamp } from "@/lib/orders-db";
import { orderStatusUpdateSchema, formatZodError } from "@/lib/validations";
import type { OrderStatus } from "@/lib/types";

const ADMIN_TRANSITIONS: Partial<Record<OrderStatus, OrderStatus>> = {
  pending_verification: "paid",
  paid: "cooking",
  cooking: "packed",
  packed: "delivered",
};

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();
  } catch (err) {
    if (err instanceof AdminUnauthorizedError) {
      return NextResponse.json({ error: "Yêu cầu quyền quản trị viên." }, { status: 401 });
    }
    return NextResponse.json({ error: "Lỗi xác thực." }, { status: 401 });
  }

  const { id } = await params;

  try {
    const order = await getOrderById(id);
    if (!order) {
      return NextResponse.json({ error: "Không tìm thấy đơn hàng." }, { status: 404 });
    }

    const body = await request.json().catch(() => ({}));
    const rawStatus = body.newStatus ?? body.status;
    const validation = orderStatusUpdateSchema.safeParse({ status: rawStatus });

    if (!validation.success) {
      return NextResponse.json(
        { error: formatZodError(validation.error) },
        { status: 400 }
      );
    }

    const newStatus = validation.data.status;

    if (ADMIN_TRANSITIONS[order.status] !== newStatus) {
      return NextResponse.json(
        { error: `Không thể chuyển từ "${order.status}" sang "${newStatus}".` },
        { status: 409 }
      );
    }

    const result = await updateOrderStatusWithTimestamp(id, newStatus);
    if (!result.ok) {
      return NextResponse.json(
        { error: result.error ?? "Không thể cập nhật trạng thái." },
        { status: 409 }
      );
    }

    return NextResponse.json({ ok: true, status: newStatus });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Lỗi máy chủ." },
      { status: 500 }
    );
  }
}
