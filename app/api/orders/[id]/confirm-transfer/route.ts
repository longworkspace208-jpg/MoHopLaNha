import { NextResponse } from "next/server";
import { getOrderById, updateOrderStatus } from "@/lib/orders-db";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const order = await getOrderById(id);

    if (!order) {
      return NextResponse.json(
        { error: "Không tìm thấy đơn hàng cần xác nhận." },
        { status: 404 }
      );
    }

    if (order.status === "paid") {
      return NextResponse.json({
        ok: true,
        message: "Đơn hàng đã được quản trị viên duyệt trước đó.",
        status: order.status
      });
    }

    // CHỈ đặt status='pending_verification', không đổi sang 'paid'
    const success = await updateOrderStatus(order.id, "pending_verification");
    if (!success) {
      return NextResponse.json(
        { error: "Không thể cập nhật trạng thái đơn hàng." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      status: "pending_verification",
      publicCode: order.public_code
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Lỗi xử lý yêu cầu." },
      { status: 500 }
    );
  }
}

