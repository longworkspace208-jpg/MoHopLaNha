import { NextResponse } from "next/server";
import { requireAdmin, AdminUnauthorizedError } from "@/lib/admin-auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";

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
    const { data, error } = await createServerSupabaseClient()
      .from("orders")
      .update({ status: "paid", paid_at: new Date().toISOString() })
      .eq("id", id)
      .in("status", ["awaiting_payment", "pending_verification"])
      .select("id")
      .maybeSingle();

    if (error) throw error;
    if (!data) {
      return NextResponse.json(
        { error: "Đơn không ở trạng thái chờ xác nhận thanh toán." },
        { status: 409 }
      );
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Có lỗi máy chủ." },
      { status: 500 }
    );
  }
}
