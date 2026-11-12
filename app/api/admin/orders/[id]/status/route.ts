import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-auth";
import { getOrderById, updateOrderStatusWithTimestamp } from "@/lib/orders-db";
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
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Không có quyền truy cập." }, { status: 401 });
  }

  const { id } = await params;

  try {
    const order = await getOrderById(id);
    if (!order) {
      return NextResponse.json({ error: "Không tìm thấy đơn hàng." }, { status: 404 });
    }

    const body = await request.json();
    const newStatus = (body.newStatus ?? body.status) as OrderStatus | undefined;

    if (!newStatus || ADMIN_TRANSITIONS[order.status] !== newStatus) {
      return NextResponse.json(
        { error: `Không thể chuyển từ "${order.status}" sang "${newStatus ?? ""}".` },
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
