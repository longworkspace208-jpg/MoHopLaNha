import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const cookieToken = request.headers.get("cookie")?.match(/(?:^|; )mhln_admin=([^;]+)/)?.[1];
  if (!process.env.ADMIN_PASSCODE || cookieToken !== encodeURIComponent(process.env.ADMIN_PASSCODE)) return NextResponse.json({ error: "Không có quyền xác nhận thanh toán." }, { status: 401 });
  const { id } = await params;
  try {
    const { data, error } = await createServerSupabaseClient().from("orders").update({ status: "paid", paid_at: new Date().toISOString() }).eq("id", id).eq("status", "pending_payment").select("id").maybeSingle();
    if (error) throw error;
    if (!data) return NextResponse.json({ error: "Đơn không ở trạng thái chờ xác nhận." }, { status: 409 });
    return NextResponse.json({ ok: true });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Có lỗi máy chủ." }, { status: 500 }); }
}
