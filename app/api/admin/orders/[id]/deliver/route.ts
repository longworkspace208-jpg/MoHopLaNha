import { NextResponse } from "next/server";
import { requireAdmin, AdminUnauthorizedError } from "@/lib/admin-auth";
import { getOrderById, updateOrderStatusWithTimestamp } from "@/lib/orders-db";

export async function POST(
  _request: Request,
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

    if (order.status !== "packed") {
      return NextResponse.json(
        { error: `Đơn hàng phải ở trạng thái "packed" (hiện tại: "${order.status}").` },
        { status: 409 }
      );
    }

    const result = await updateOrderStatusWithTimestamp(id, "delivered");
    if (!result.ok) {
      return NextResponse.json(
        { error: result.error ?? "Không thể cập nhật trạng thái." },
        { status: 409 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Lỗi máy chủ." },
      { status: 500 }
    );
  }
}
