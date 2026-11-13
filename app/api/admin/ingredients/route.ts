import { NextResponse } from "next/server";
import { requireAdmin, AdminUnauthorizedError } from "@/lib/admin-auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { ingredientSchema, formatZodError } from "@/lib/validations";

export async function GET() {
  try {
    await requireAdmin();
  } catch (err) {
    if (err instanceof AdminUnauthorizedError) {
      return NextResponse.json({ error: "Yêu cầu quyền quản trị viên." }, { status: 401 });
    }
    return NextResponse.json({ error: "Lỗi xác thực." }, { status: 401 });
  }

  const { data, error } = await createServerSupabaseClient()
    .from("ingredients")
    .select("*")
    .order("name");

  return error
    ? NextResponse.json({ error: error.message }, { status: 500 })
    : NextResponse.json(data);
}

export async function POST(request: Request) {
  try {
    await requireAdmin();
  } catch (err) {
    if (err instanceof AdminUnauthorizedError) {
      return NextResponse.json({ error: "Yêu cầu quyền quản trị viên." }, { status: 401 });
    }
    return NextResponse.json({ error: "Lỗi xác thực." }, { status: 401 });
  }

  try {
    const raw = await request.json().catch(() => ({}));
    const validation = ingredientSchema.safeParse(raw);

    if (!validation.success) {
      return NextResponse.json(
        { error: formatZodError(validation.error) },
        { status: 400 }
      );
    }

    const { data, error } = await createServerSupabaseClient()
      .from("ingredients")
      .insert(validation.data)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Không thể lưu nguyên liệu." },
      { status: 400 }
    );
  }
}
