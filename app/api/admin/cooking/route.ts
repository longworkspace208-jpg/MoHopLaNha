import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-auth";
import { saveCookingBatch, getAllCookingBatches, isSupabaseConfigured } from "@/lib/orders-db";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Không có quyền truy cập." }, { status: 401 });
  }

  try {
    const body = await request.json();
    const dishId = String(body.dishId ?? "").trim();
    const dishName = String(body.dishName ?? "").trim();
    const lotCode = String(body.lotCode ?? "").trim();
    const supplierNote = body.supplierNote ? String(body.supplierNote).trim() : null;
    const cookedYieldG = Number(body.cookedYieldG);
    const cookedAt = String(body.cookedAt ?? "").trim();

    if (!dishId || !dishName || !lotCode || !cookedAt) {
      return NextResponse.json(
        { error: "Thiếu thông tin bắt buộc: dishId, dishName, lotCode, cookedYieldG, cookedAt." },
        { status: 400 }
      );
    }

    if (!Number.isFinite(cookedYieldG) || cookedYieldG <= 0) {
      return NextResponse.json(
        { error: "cookedYieldG phải là số dương." },
        { status: 400 }
      );
    }

    const batch = await saveCookingBatch({
      dishId,
      dishName,
      lotCode,
      supplierNote,
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
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Không có quyền truy cập." }, { status: 401 });
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
