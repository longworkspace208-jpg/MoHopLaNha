import { NextResponse } from "next/server";
import { requireAdmin, AdminUnauthorizedError } from "@/lib/admin-auth";
import { saveCookingBatch, getAllCookingBatches, isSupabaseConfigured } from "@/lib/orders-db";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { cookingBatchCreateSchema, formatZodError } from "@/lib/validations";

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
    const rawBody = await request.json().catch(() => ({}));
    const validation = cookingBatchCreateSchema.safeParse(rawBody);

    if (!validation.success) {
      return NextResponse.json(
        { error: formatZodError(validation.error) },
        { status: 400 }
      );
    }

    const { dishId, dishName, lotCode, supplierNote, cookedYieldG, cookedAt } =
      validation.data;

    const batch = await saveCookingBatch({
      dishId,
      dishName,
      lotCode,
      supplierNote: supplierNote ?? null,
      cookedYieldG,
      cookedAt,
    });

    return NextResponse.json({ ok: true, batch });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Lỗi máy chủ." },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    await requireAdmin();
  } catch (err) {
    if (err instanceof AdminUnauthorizedError) {
      return NextResponse.json({ error: "Yêu cầu quyền quản trị viên." }, { status: 401 });
    }
    return NextResponse.json({ error: "Lỗi xác thực." }, { status: 401 });
  }

  try {
    if (isSupabaseConfigured()) {
      try {
        const supabase = createServerSupabaseClient();
        const { data, error } = await supabase
          .from("cooking_batches")
          .select("*")
          .order("cooked_at", { ascending: false });

        if (!error && data) {
          const batches = data.map((row) => ({
            id: row.id,
            dishId: row.dish_id,
            dishName: row.dish_name,
            lotCode: row.lot_code,
            supplierNote: row.supplier_note ?? null,
            cookedYieldG: Number(row.cooked_yield_g),
            cookedAt: row.cooked_at,
          }));
          return NextResponse.json({ batches });
        }
      } catch (err) {
        console.warn("Supabase GET cooking_batches error:", err);
      }
    }

    const batches = getAllCookingBatches();
    return NextResponse.json({ batches });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Lỗi máy chủ." },
      { status: 500 }
    );
  }
}
