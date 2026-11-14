import { NextResponse } from "next/server";
import { requireAdmin, AdminUnauthorizedError } from "@/lib/admin-auth";
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
import { calculatePerPersonEstimate } from "@/lib/production";

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

    const body = await request.json().catch(() => ({}));
    const portions: PortionInput[] = body.portions ?? [];

    if (!Array.isArray(portions) || portions.length === 0) {
      return NextResponse.json({ error: "Cần cung cấp danh sách portions." }, { status: 400 });
    }

    const packedAt = new Date().toISOString();
    const savedPortions: PortionSnapshot[] = [];

    for (let idx = 0; idx < portions.length; idx++) {
      const portion = portions[idx];

      const item =
        portion.orderItemId != null
          ? order.items.find((it) => it.id != null && String(it.id) === String(portion.orderItemId))
          : order.items[idx];

      if (!item) {
        return NextResponse.json(
          { error: `Không tìm thấy order item cho portion thứ ${idx + 1}.` },
          { status: 400 }
        );
      }

      const actualGrams = Number(portion.actualGrams);
      if (!Number.isFinite(actualGrams) || actualGrams <= 0 || actualGrams > 10000) {
        return NextResponse.json(
          { error: `actualGrams của "${item.name}" phải là số dương hợp lệ (tối đa 10,000g).` },
          { status: 400 }
        );
      }

      const seq = String(idx + 1).padStart(3, "0");
      const prefix = toAsciiUpperPrefix(item.name);
      const qrCode = `${order.public_code}-${prefix}-${seq}`;

      const nominalGrams = item.grams > 0 ? item.grams : actualGrams;
      const ratio = actualGrams / nominalGrams;
      const kcal = Number((item.nutrition.kcal * ratio).toFixed(2));
      const proteinG = Number((item.nutrition.protein * ratio).toFixed(2));
      const carbsG = Number((item.nutrition.carbs * ratio).toFixed(2));
      const fatG = Number((item.nutrition.fat * ratio).toFixed(2));

      const batch = await resolveCookingBatch(portion.cookedBatchId);

      const ingredientsSnapshot =
        portion.ingredients && portion.ingredients.length > 0
          ? portion.ingredients.map((ing) => ({
              name: ing.name,
              rawG: ing.rawG,
              allergens: ing.allergens ?? [],
            }))
          : await getDishIngredientsSnapshot(item.dishId);

      const allergens =
        portion.allergens && portion.allergens.length > 0
          ? portion.allergens
          : Array.from(
              new Set(
                ingredientsSnapshot.flatMap((ing) => ing.allergens ?? [])
              )
            );

      const cookedAt =
        portion.cookedAt ??
        (batch?.cookedAt ? batch.cookedAt.slice(0, 10) : packedAt.slice(0, 10));
      const sourceNote = portion.sourceNote ?? batch?.supplierNote ?? null;
      const lotCode = portion.lotCode ?? batch?.lotCode ?? null;

      const orderPeople = Math.max(1, order.people ?? 1);
      const perPersonEstimate = calculatePerPersonEstimate(
        { kcal, protein: proteinG, carbs: carbsG, fat: fatG },
        orderPeople
      );

      const saved = await savePortionSnapshot({
        orderId: order.id,
        orderItemId: Number(item.id ?? idx + 1),
        qrCode,
        dishName: item.name,
        cookedAt,
        cookedBatchId: isUuid(portion.cookedBatchId) ? portion.cookedBatchId.trim() : null,
        actualGrams,
        kcal,
        proteinG,
        carbsG,
        fatG,
        ingredients: ingredientsSnapshot,
        allergens,
        sourceNote,
        lotCode,
        people: orderPeople,
        per_person_estimate: perPersonEstimate,
        packedAt,
      });

      savedPortions.push(saved);
    }

    const result = await updateOrderStatusWithTimestamp(id, "packed");
    if (!result.ok) {
      return NextResponse.json(
        { error: result.error ?? "Không thể cập nhật trạng thái sang packed." },
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
