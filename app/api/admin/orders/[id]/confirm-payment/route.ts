import { NextResponse } from "next/server";
import { requireAdmin, AdminUnauthorizedError } from "@/lib/admin-auth";
import { transitionOrderStatus } from "@/lib/orders-db";
import type { OrderStatus } from "@/lib/types";

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
  const body = await request.json().catch(() => ({}));
  const isRestore = Boolean(body.restoreExpired);

  const expectedCurrentStatuses: OrderStatus[] = isRestore
    ? ["cancelled"]
    : ["awaiting_payment", "pending_verification"];

  const result = await transitionOrderStatus(id, "paid", {
    actor: "admin",
    note: isRestore
      ? "Khôi phục và xác nhận đã nhận tiền (đơn chuyển khoản trễ)"
      : "Admin xác nhận đã nhận đủ tiền chuyển khoản",
    expectedCurrentStatuses,
  });

  if (!result.ok) {
    return NextResponse.json(
      { error: result.error ?? "Không thể xác nhận thanh toán đơn hàng." },
      { status: result.conflict ? 409 : 400 }
    );
  }

  return NextResponse.json({ ok: true, order: result.order });
}
