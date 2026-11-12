import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-auth";
import {
  getCookingBatch,
  getDishIngredientsSnapshot,
  getOrderById,
  getPortionsByOrder,
  isSupabaseConfigured,
  savePortionSnapshot,
  updateOrderStatusWithTimestamp,
} from "@/lib/orders-db";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { CookingBatch, PortionSnapshot } from "@/lib/types";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUuid(value?: string | null): value is string {
  return typeof value === "string" && UUID_REGEX.test(value.trim());
}

function toAsciiUpperPrefix(name: string): string {
  const ascii = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[đĐ]/g, "D")
    .toUpperCase()
    .replace(/[^A-Z]/g, "");
  return ascii.substring(0, 2) || "XX";
}

async function resolveCookingBatch(batchId?: string | null): Promise<CookingBatch | null> {
  if (!isUuid(batchId)) return null;
  const validBatchId = batchId.trim();
  const fromFallback = getCookingBatch(validBatchId);
  if (fromFallback) return fromFallback;

  if (isSupabaseConfigured()) {
    try {
      const { data, error } = await createServerSupabaseClient()
        .from("cooking_batches")
        .select("*")
        .eq("id", validBatchId)
        .maybeSingle();
      if (!error && data) {
        return {
          id: data.id,
          dishId: data.dish_id,
          dishName: data.dish_name,
          lotCode: data.lot_code,
          supplierNote: data.supplier_note ?? null,
          cookedYieldG: Number(data.cooked_yield_g),
          cookedAt: data.cooked_at,
        };
      }
    } catch (err) {
      console.warn("Supabase resolveCookingBatch error:", err);
    }
  }
  return null;
}

type PortionInput = {
  orderItemId?: number | string;
  actualGrams: number;
  cookedBatchId?: string | null;
  cookedAt?: string;
  ingredients?: Array<{ name: string; rawG: number; allergens?: string[] }>;
  allergens?: string[];
  sourceNote?: string | null;
  lotCode?: string | null;
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

    if (order.status !== "cooking") {
      return NextResponse.json(
        { error: `Đơn hàng phải ở trạng thái "cooking" (hiện tại: "${order.status}").` },
        { status: 409 }
      );
    }

    const existingPortions = await getPortionsByOrder(id);
    if (existingPortions.length > 0) {
      return NextResponse.json(
        { error: "Đơn hàng đã có nutrition snapshot, không thể ghi đè." },
        { status: 409 }
      );
    }

    const body = await request.json();
    const portions: PortionInput[] = body.portions ?? [];

    if (!Array.isArray(portions) || portions.length === 0) {
      return NextResponse.json({ error: "Cần cung cấp danh sách portions." }, { status: 400 });
    }

    const packedAt = new Date().toISOString();
    const savedPortions: PortionSnapshot[] = [];

    for (let idx = 0; idx < portions.length; idx++) {
      const portion = portions[idx];

      // Match by item.id if provided, otherwise fall back to positional index
      const item =
        (portion.orderItemId != null
          ? order.items.find((it) => it.id != null && String(it.id) === String(portion.orderItemId))
          : undefined) ?? order.items[idx];

      if (!item) {
        return NextResponse.json(
          { error: `Không tìm thấy order_item tại vị trí ${idx}.` },
          { status: 400 }
        );
      }

      const originalGrams = item.grams;
      const actualGrams = Number(portion.actualGrams);

      if (!Number.isFinite(actualGrams) || actualGrams <= 0) {
        return NextResponse.json(
          { error: `actualGrams không hợp lệ tại portion index ${idx}.` },
          { status: 400 }
        );
      }

      const scale = originalGrams > 0 ? actualGrams / originalGrams : 1;
      const kcal = Number(((item.nutrition.kcal ?? 0) * scale).toFixed(2));
      const proteinG = Number(((item.nutrition.protein ?? 0) * scale).toFixed(2));
      const carbsG = Number(((item.nutrition.carbs ?? 0) * scale).toFixed(2));
      const fatG = Number(((item.nutrition.fat ?? 0) * scale).toFixed(2));

      const validBatchId = isUuid(portion.cookedBatchId) ? portion.cookedBatchId.trim() : null;
      const batch = await resolveCookingBatch(validBatchId);

      const ingredients =
        Array.isArray(portion.ingredients) && portion.ingredients.length > 0
          ? portion.ingredients.map((ing) => ({
              name: String(ing.name ?? ""),
              rawG: Number(ing.rawG ?? 0),
              allergens: Array.isArray(ing.allergens) ? ing.allergens : [],
            }))
          : await getDishIngredientsSnapshot(item.dishId);

      const allergens = Array.from(
        new Set([
          ...ingredients.flatMap((ing) => ing.allergens ?? []),
          ...(Array.isArray(portion.allergens) ? portion.allergens : []),
        ])
      );

      const dishShortCode = toAsciiUpperPrefix(item.name);
      const qrCode = `${order.public_code}-${dishShortCode}-${String(idx + 1).padStart(3, "0")}`;

      const cookedAtRaw = portion.cookedAt || batch?.cookedAt || packedAt;
      const cookedAt = String(cookedAtRaw).slice(0, 10);

      const numericItemId = Number.isFinite(Number(portion.orderItemId))
        ? Number(portion.orderItemId)
        : Number.isFinite(Number(item.id))
          ? Number(item.id)
          : idx + 1;

      const saved = await savePortionSnapshot({
        orderId: order.id,
        orderItemId: numericItemId,
        qrCode,
        dishName: item.name,
        cookedAt,
        cookedBatchId: validBatchId,
        actualGrams,
        kcal,
        proteinG,
        carbsG,
        fatG,
        ingredients,
        allergens,
        sourceNote: portion.sourceNote ?? batch?.supplierNote ?? null,
        lotCode: portion.lotCode ?? batch?.lotCode ?? null,
        packedAt,
      });

      savedPortions.push(saved);
    }

    const statusResult = await updateOrderStatusWithTimestamp(id, "packed");
    if (!statusResult.ok) {
      return NextResponse.json(
        { error: statusResult.error ?? "Không thể chuyển trạng thái sang packed." },
        { status: 409 }
      );
    }

    return NextResponse.json({ ok: true, portions: savedPortions });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Lỗi máy chủ." },
      { status: 500 }
    );
  }
}
