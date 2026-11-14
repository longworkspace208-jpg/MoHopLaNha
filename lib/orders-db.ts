import fs from "node:fs";
import path from "node:path";
import { nanoid } from "nanoid";
import { createServerSupabaseClient } from "./supabase/server";
import { calcDish, calcPortion, type Macros } from "./nutrition";
import type { CookingBatch, OrderEvent, OrderItemSnapshot, OrderRecord, OrderStatus, PortionSnapshot } from "./types";
import { DELIVERY_CONFIG } from "./delivery-config";
import { getBankConfig } from "./bank-config";
import { validateGramsForDish } from "./validations";
import demoSeed from "./demo-seed.json";

export class OutOfStockError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OutOfStockError";
  }
}

export type OrderCreationItem = {
  dishId: string;
  grams: number;
};

export type OrderCreationInput = {
  customerName: string;
  phone: string;
  deliveryAddress: string;
  customerEmail?: string | null;
  note?: string | null;
  items: OrderCreationItem[];
  people?: number;
  goal?: string | null;
};

// ==========================================
// SEED DỮ LIỆU MẪU KHI CHƯA KẾT NỐI SUPABASE
// ==========================================
type SeedIngredient = {
  id: string;
  name: string;
  kcal_per100: number;
  protein_per100: number;
  carbs_per100: number;
  fat_per100: number;
  allergens: string[];
};

const SEED_INGREDIENTS: Record<string, SeedIngredient> = Object.fromEntries(
  demoSeed.ingredients.map((ing) => [
    ing.id,
    {
      id: ing.id,
      name: ing.name,
      kcal_per100: ing.kcal_per100,
      protein_per100: ing.protein_per100,
      carbs_per100: ing.carbs_per100,
      fat_per100: ing.fat_per100,
      allergens: [...ing.allergens]
    }
  ])
);

export type FallbackDish = {
  id: string;
  name: string;
  price_vnd: number;
  image_url: string | null;
  yield_g: number;
  approved: boolean;
  portion_limit: number;
  step_g: number;
  min_g: number;
  max_g: number;
  recipe: Array<{ ingredientId: string; raw_g: number }>;
  nutrition_per100: Macros;
};

function todayYmdVn(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(new Date());
  const part = (type: "year" | "month" | "day") => parts.find((v) => v.type === type)?.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}

function toYmdVn(isoStr: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(new Date(isoStr));
  const part = (type: "year" | "month" | "day") => parts.find((v) => v.type === type)?.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}

function buildFallbackDishes(): FallbackDish[] {
  return demoSeed.dishes.map((dish) => {
    const recipeItems = dish.recipe.map((r) => {
      const ing = SEED_INGREDIENTS[r.ingredientId];
      return {
        raw_g: r.raw_g,
        per100: {
          kcal: ing.kcal_per100,
          protein: ing.protein_per100,
          carbs: ing.carbs_per100,
          fat: ing.fat_per100
        }
      };
    });
    return {
      id: dish.id,
      name: dish.name,
      price_vnd: dish.price_vnd,
      image_url: dish.image_url,
      yield_g: dish.yield_g,
      approved: dish.approved,
      portion_limit: dish.portion_limit,
      step_g: dish.step_g,
      min_g: dish.min_g,
      max_g: dish.max_g,
      recipe: dish.recipe,
      nutrition_per100: calcDish(recipeItems, dish.yield_g)
    };
  });
}

// In-memory singletons for demo mode
const globalFallback = globalThis as unknown as {
  _fallbackDishes?: FallbackDish[];
  _fallbackOrders?: Map<string, OrderRecord>;
  _fallbackOrderEvents?: OrderEvent[];
  _fallbackDemoSeedMarker?: string;
};

const globalFallbackBatches = globalThis as unknown as {
  _fallbackBatches?: Map<string, CookingBatch>;
  _fallbackPortions?: Map<string, PortionSnapshot>;
};

export function resetFallbackDemoData(): void {
  const dishes = buildFallbackDishes();
  const dishById = new Map(dishes.map((d) => [d.id, d]));
  const orders = new Map<string, OrderRecord>();
  const batches = new Map<string, CookingBatch>();
  const portions = new Map<string, PortionSnapshot>();

  const nowMs = Date.now();
  const todayDate = todayYmdVn();
  const todayStartMs = new Date(`${todayDate}T00:00:00+07:00`).getTime();

  for (let i = 0; i < demoSeed.cookingBatches.length; i++) {
    const b = demoSeed.cookingBatches[i];
    batches.set(b.id, {
      id: b.id,
      dishId: b.dishId,
      dishName: b.dishName,
      lotCode: b.lotCode,
      supplierNote: b.supplierNote,
      cookedYieldG: b.cookedYieldG,
      cookedAt: new Date(nowMs - (i + 2) * 3600_000).toISOString()
    });
  }

  for (let idx = 0; idx < demoSeed.orders.length; idx++) {
    const spec = demoSeed.orders[idx];
    const orderTimeMs = Math.max(
      todayStartMs + (idx + 1) * 1000,
      nowMs - (demoSeed.orders.length - idx) * 900_000
    );
    const createdAt = new Date(orderTimeMs).toISOString();
    let subtotal = 0;
    const totalNutrition: Macros = { kcal: 0, protein: 0, carbs: 0, fat: 0 };

    const items: OrderItemSnapshot[] = spec.items.map((reqItem, itemIdx) => {
      const dish = dishById.get(reqItem.dishId)!;
      const portionNutrition = calcPortion(dish.nutrition_per100, reqItem.grams);
      const itemPrice = Math.round((dish.price_vnd / dish.yield_g) * reqItem.grams);
      subtotal += itemPrice;
      totalNutrition.kcal += portionNutrition.kcal;
      totalNutrition.protein += portionNutrition.protein;
      totalNutrition.carbs += portionNutrition.carbs;
      totalNutrition.fat += portionNutrition.fat;
      return {
        id: idx * 10 + itemIdx + 1,
        dishId: dish.id,
        name: dish.name,
        grams: reqItem.grams,
        unitPrice: itemPrice,
        nutrition: portionNutrition
      };
    });

    const status = spec.status as OrderStatus;
    const paidAt = ["paid", "cooking", "packed", "delivered"].includes(status)
      ? new Date(nowMs - 3000_000).toISOString()
      : null;
    const cookingAt = ["cooking", "packed", "delivered"].includes(status)
      ? new Date(nowMs - 2000_000).toISOString()
      : null;
    const packedAt = ["packed", "delivered"].includes(status)
      ? new Date(nowMs - 1000_000).toISOString()
      : null;
    const deliveredAt = status === "delivered" ? new Date(nowMs - 300_000).toISOString() : null;

    const expiresAt =
      status === "cancelled"
        ? new Date(orderTimeMs).toISOString()
        : new Date(nowMs + 60 * 60 * 1000).toISOString();
    const cancelReason = status === "cancelled" ? "expired" : null;

    orders.set(spec.id, {
      id: spec.id,
      public_token: (spec as { publicToken?: string }).publicToken || `tok_demo_${spec.publicCode.toLowerCase()}`,
      public_code: spec.publicCode,
      customer_name: spec.customerName,
      phone: spec.phone,
      customer_email: spec.customerEmail,
      delivery_address: spec.deliveryAddress,
      note: spec.note,
      status,
      subtotal_vnd: subtotal,
      shipping_fee_vnd: DELIVERY_CONFIG.shippingFeeVnd,
      total_vnd: subtotal + DELIVERY_CONFIG.shippingFeeVnd,
      nutrition_snapshot: totalNutrition,
      people: (spec as { people?: number }).people ?? 1,
      goal: (spec as { goal?: string }).goal ?? "balanced",
      items,
      created_at: createdAt,
      expires_at: expiresAt,
      cancel_reason: cancelReason,
      paid_at: paidAt,
      cooking_at: cookingAt,
      packed_at: packedAt,
      delivered_at: deliveredAt
    });

    if (spec.portionSnapshot) {
      const snap = spec.portionSnapshot;
      const dish = dishById.get(snap.dishId)!;
      const snapNutrition = calcPortion(dish.nutrition_per100, snap.actualGrams);
      const ingSnapshot = dish.recipe.map((r) => {
        const ing = SEED_INGREDIENTS[r.ingredientId];
        return {
          name: ing.name,
          rawG: r.raw_g,
          allergens: [...ing.allergens]
        };
      });
      const allergens = Array.from(new Set(ingSnapshot.flatMap((i) => i.allergens)));
      portions.set(snap.id, {
        id: snap.id,
        orderId: spec.id,
        orderItemId: items[0].id as number,
        qrCode: snap.qrCode,
        dishName: dish.name,
        cookedAt: todayDate,
        cookedBatchId: snap.cookedBatchId,
        actualGrams: snap.actualGrams,
        kcal: Number(snapNutrition.kcal.toFixed(2)),
        proteinG: Number(snapNutrition.protein.toFixed(2)),
        carbsG: Number(snapNutrition.carbs.toFixed(2)),
        fatG: Number(snapNutrition.fat.toFixed(2)),
        ingredients: ingSnapshot,
        allergens,
        sourceNote: snap.sourceNote,
        lotCode: snap.lotCode,
        people: 1,
        per_person_estimate: {
          kcal: Number(snapNutrition.kcal.toFixed(2)),
          protein: Number(snapNutrition.protein.toFixed(2)),
          carbs: Number(snapNutrition.carbs.toFixed(2)),
          fat: Number(snapNutrition.fat.toFixed(2))
        },
        packedAt: packedAt ?? createdAt
      });
    }
  }

  globalFallback._fallbackDishes = dishes;
  globalFallback._fallbackOrders = orders;
  globalFallback._fallbackOrderEvents = [];
  globalFallbackBatches._fallbackBatches = batches;
  globalFallbackBatches._fallbackPortions = portions;
}

function ensureDemoSeedLoaded() {
  if (!globalFallback._fallbackDishes || !globalFallback._fallbackOrders) {
    resetFallbackDemoData();
  }
  if (!isSupabaseConfigured()) {
    try {
      const markerPath = path.join(process.cwd(), ".demo-seed-version");
      if (fs.existsSync(markerPath)) {
        const marker = fs.readFileSync(markerPath, "utf8").trim();
        if (marker && globalFallback._fallbackDemoSeedMarker && marker !== globalFallback._fallbackDemoSeedMarker) {
          resetFallbackDemoData();
        }
        if (marker) {
          globalFallback._fallbackDemoSeedMarker = marker;
        }
      }
    } catch {
      // Ignore read errors on read-only / restricted runtimes
    }
  }
}

export function isSupabaseConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

export function getFallbackIngredients(): SeedIngredient[] {
  return Object.values(SEED_INGREDIENTS);
}

export function getFallbackDishes(): FallbackDish[] {
  ensureDemoSeedLoaded();
  return globalFallback._fallbackDishes!;
}

export function getFallbackTodayOrderedCounts(): Map<string, number> {
  ensureDemoSeedLoaded();
  const today = todayYmdVn();
  const counts = new Map<string, number>();
  for (const order of globalFallback._fallbackOrders!.values()) {
    if (order.status === "cancelled") continue;
    if (toYmdVn(order.created_at) !== today) continue;
    for (const item of order.items) {
      counts.set(item.dishId, (counts.get(item.dishId) ?? 0) + 1);
    }
  }
  return counts;
}

/**
 * Sinh mã đơn MHLN#### (4 chữ số ngẫu nhiên không trùng lặp)
 */
export async function generateUniqueOrderCode(): Promise<string> {
  ensureDemoSeedLoaded();
  const maxAttempts = 100;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const randomDigits = Math.floor(1000 + Math.random() * 9000); // 1000 - 9999
    const code = `MHLN${randomDigits}`;

    if (isSupabaseConfigured()) {
      try {
        const { data } = await createServerSupabaseClient()
          .from("orders")
          .select("id")
          .eq("public_code", code)
          .maybeSingle();
        if (!data) return code;
      } catch {
        // Fallback check
        const exists = Array.from(globalFallback._fallbackOrders!.values()).some(
          (o) => o.public_code === code
        );
        if (!exists) return code;
      }
    } else {
      const exists = Array.from(globalFallback._fallbackOrders!.values()).some(
        (o) => o.public_code === code
      );
      if (!exists) return code;
    }
  }

  // Fallback an toàn nếu trùng nhiều lần
  return `MHLN${Math.floor(1000 + Math.random() * 9000)}`;
}

async function getSupabaseTodayMenuLimits(dishIds: string[]): Promise<Map<string, number> | null> {
  if (!isSupabaseConfigured()) return null;
  try {
    const supabase = createServerSupabaseClient();
    const today = todayYmdVn();
    const { data: day } = await supabase
      .from("menu_days")
      .select("id")
      .eq("menu_date", today)
      .eq("published", true)
      .maybeSingle();
    if (!day) return null;

    const { data: saleDishes } = await supabase
      .from("menu_dishes")
      .select("dish_id, portion_limit")
      .eq("menu_day_id", day.id)
      .in("dish_id", dishIds);
    if (!saleDishes) return null;

    const startIso = `${today}T00:00:00+07:00`;
    const { data: todayOrders } = await supabase
      .from("orders")
      .select("id, status")
      .gte("created_at", startIso)
      .neq("status", "cancelled");

    const orderIds = (todayOrders ?? []).map((o) => o.id);
    const usedCounts = new Map<string, number>();
    if (orderIds.length > 0) {
      const { data: todayItems } = await supabase
        .from("order_items")
        .select("dish_id")
        .in("order_id", orderIds)
        .in("dish_id", dishIds);
      for (const row of todayItems ?? []) {
        usedCounts.set(row.dish_id, (usedCounts.get(row.dish_id) ?? 0) + 1);
      }
    }

    const remaining = new Map<string, number>();
    for (const s of saleDishes) {
      const used = usedCounts.get(s.dish_id) ?? 0;
      remaining.set(s.dish_id, Math.max(0, Number(s.portion_limit) - used));
    }
    return remaining;
  } catch {
    return null;
  }
}

/**
 * Tính toán lại giá và dinh dưỡng từ Database hoặc Fallback
 */
export async function calculateOrderFromDb(items: OrderCreationItem[], people: number = 1) {
  if (!items || items.length === 0) {
    throw new Error("Đơn hàng không có món nào.");
  }

  ensureDemoSeedLoaded();
  const safePeople = Math.max(1, Math.min(10, Math.round(people || 1)));
  const calculatedItems: OrderItemSnapshot[] = [];
  const totalNutrition: Macros = { kcal: 0, protein: 0, carbs: 0, fat: 0 };
  let subtotal = 0;
  const fallbackDishes = getFallbackDishes();

  if (isSupabaseConfigured()) {
    try {
      const supabase = createServerSupabaseClient();
      const dishIds = items.map((i) => i.dishId);

      const [{ data: dishes, error: dishError }, { data: recipeRows }, remainingMap] =
        await Promise.all([
          supabase.from("dishes").select("id, name, price_vnd, yield_g, approved").in("id", dishIds),
          supabase
            .from("dish_ingredients")
            .select("dish_id, raw_g, ingredients(kcal_per100, protein_per100, carbs_per100, fat_per100)")
            .in("dish_id", dishIds),
          getSupabaseTodayMenuLimits(dishIds)
        ]);

      if (dishError || !dishes || dishes.length !== dishIds.length) {
        throw new Error("Không thể tải thông tin món ăn từ database.");
      }

      for (const reqItem of items) {
        const dish = dishes.find((d) => d.id === reqItem.dishId);
        if (!dish || !dish.approved) {
          throw new Error(`Món ăn ${reqItem.dishId} chưa được duyệt hoặc không tồn tại.`);
        }
        if (remainingMap && remainingMap.has(dish.id) && (remainingMap.get(dish.id) ?? 0) <= 0) {
          throw new OutOfStockError(`Món "${dish.name}" đã hết suất hôm nay. Vui lòng chọn món khác.`);
        }
        if (!Number.isFinite(reqItem.grams) || reqItem.grams <= 0) {
          throw new Error(`Khối lượng phần ăn ${dish.name} không hợp lệ.`);
        }

        const fallbackDish = fallbackDishes.find((d) => d.id === dish.id);
        const meta = {
          name: dish.name,
          min_g: fallbackDish?.min_g ?? 50,
          max_g: fallbackDish?.max_g ?? 250,
          step_g: fallbackDish?.step_g ?? 10,
        };
        const valCheck = validateGramsForDish(meta, reqItem.grams, safePeople);
        if (!valCheck.valid) {
          throw new Error(valCheck.error);
        }

        const ingredientsForDish = (recipeRows ?? [])
          .filter((r) => r.dish_id === dish.id)
          .map((r) => ({
            raw_g: Number(r.raw_g),
            per100: {
              kcal: Number((r.ingredients as unknown as SeedIngredient).kcal_per100),
              protein: Number((r.ingredients as unknown as SeedIngredient).protein_per100),
              carbs: Number((r.ingredients as unknown as SeedIngredient).carbs_per100),
              fat: Number((r.ingredients as unknown as SeedIngredient).fat_per100)
            }
          }));

        const nutritionPer100 = calcDish(ingredientsForDish, Number(dish.yield_g));
        const portionNutrition = calcPortion(nutritionPer100, reqItem.grams);
        const itemPrice = Math.round((dish.price_vnd / Number(dish.yield_g)) * reqItem.grams);

        subtotal += itemPrice;
        totalNutrition.kcal += portionNutrition.kcal;
        totalNutrition.protein += portionNutrition.protein;
        totalNutrition.carbs += portionNutrition.carbs;
        totalNutrition.fat += portionNutrition.fat;

        calculatedItems.push({
          dishId: dish.id,
          name: dish.name,
          grams: reqItem.grams,
          unitPrice: itemPrice,
          nutrition: portionNutrition
        });
      }

      return {
        items: calculatedItems,
        subtotal,
        shippingFee: DELIVERY_CONFIG.shippingFeeVnd,
        total: subtotal + DELIVERY_CONFIG.shippingFeeVnd,
        nutrition: totalNutrition
      };
    } catch (err) {
      if (err instanceof OutOfStockError) {
        throw err;
      }
      // Nếu kết nối Supabase thất bại, fallback sang tính toán offline
      console.warn("Supabase calculation failed, falling back to local store:", err);
    }
  }

  // ==========================================
  // FALLBACK CALCULATION KHI CHƯA CÓ SUPABASE
  // ==========================================
  const orderedCounts = getFallbackTodayOrderedCounts();

  for (const reqItem of items) {
    const dish = fallbackDishes.find((d) => d.id === reqItem.dishId);
    if (!dish) {
      throw new Error(`Món ăn ${reqItem.dishId} không tìm thấy trong thực đơn.`);
    }
    const remaining = Math.max(0, dish.portion_limit - (orderedCounts.get(dish.id) ?? 0));
    if (remaining <= 0) {
      throw new OutOfStockError(`Món "${dish.name}" đã hết suất hôm nay. Vui lòng chọn món khác.`);
    }
    if (!Number.isFinite(reqItem.grams) || reqItem.grams <= 0) {
      throw new Error(`Khối lượng phần ăn ${dish.name} không hợp lệ.`);
    }

    const valCheck = validateGramsForDish(dish, reqItem.grams, safePeople);
    if (!valCheck.valid) {
      throw new Error(valCheck.error);
    }

    const portionNutrition = calcPortion(dish.nutrition_per100, reqItem.grams);
    const itemPrice = Math.round((dish.price_vnd / dish.yield_g) * reqItem.grams);

    subtotal += itemPrice;
    totalNutrition.kcal += portionNutrition.kcal;
    totalNutrition.protein += portionNutrition.protein;
    totalNutrition.carbs += portionNutrition.carbs;
    totalNutrition.fat += portionNutrition.fat;

    calculatedItems.push({
      dishId: dish.id,
      name: dish.name,
      grams: reqItem.grams,
      unitPrice: itemPrice,
      nutrition: portionNutrition
    });
  }

  return {
    items: calculatedItems,
    subtotal,
    shippingFee: DELIVERY_CONFIG.shippingFeeVnd,
    total: subtotal + DELIVERY_CONFIG.shippingFeeVnd,
    nutrition: totalNutrition
  };
}

/**
 * Tạo đơn hàng mới trong DB / Fallback
 */
export async function createOrderInDb(input: OrderCreationInput & { publicToken?: string }): Promise<{ orderId: string; publicCode: string; publicToken: string; expiresAt: string }> {
  const safePeople = Math.max(1, Math.min(10, Math.round(input.people ?? 1)));
  const calculated = await calculateOrderFromDb(input.items, safePeople);
  const publicCode = await generateUniqueOrderCode();
  const orderId = crypto.randomUUID();
  const publicToken = input.publicToken || nanoid(21);
  const paymentWindowMin = getBankConfig().paymentWindowMin;
  const expiresAt = new Date(Date.now() + paymentWindowMin * 60 * 1000).toISOString();

  if (isSupabaseConfigured()) {
    try {
      const supabase = createServerSupabaseClient();
      const { data: order, error: orderError } = await supabase
        .from("orders")
        .insert({
          id: orderId,
          public_token: publicToken,
          public_code: publicCode,
          customer_name: input.customerName,
          phone: input.phone,
          customer_email: input.customerEmail || null,
          delivery_address: input.deliveryAddress,
          note: input.note || null,
          status: "awaiting_payment",
          shipping_fee_vnd: calculated.shippingFee,
          total_vnd: calculated.total,
          nutrition_snapshot: calculated.nutrition,
          people: safePeople,
          goal: input.goal || null,
          expires_at: expiresAt,
        })
        .select("id, public_code, public_token, expires_at")
        .single();

      if (orderError || !order) {
        throw new Error(orderError?.message ?? "Không thể lưu đơn hàng vào database.");
      }

      const { error: itemsError } = await supabase.from("order_items").insert(
        calculated.items.map((item) => ({
          order_id: order.id,
          dish_id: item.dishId,
          name_snapshot: item.name,
          unit_price_vnd: item.unitPrice,
          quantity: 1,
          nutrition_snapshot: {
            grams: item.grams,
            ...item.nutrition
          }
        }))
      );

      if (itemsError) {
        await supabase.from("orders").delete().eq("id", order.id);
        throw new Error(itemsError.message);
      }

      await recordOrderEvent(order.id, null, "awaiting_payment", "customer", "Khách tạo đơn hàng");
      return { orderId: order.id, publicCode: order.public_code, publicToken: order.public_token || publicToken, expiresAt };
    } catch (err) {
      console.warn("Supabase order creation failed, persisting to fallback:", err);
    }
  }

  // Lưu fallback
  const record: OrderRecord = {
    id: orderId,
    public_token: publicToken,
    public_code: publicCode,
    customer_name: input.customerName,
    phone: input.phone,
    customer_email: input.customerEmail || null,
    delivery_address: input.deliveryAddress,
    note: input.note || null,
    status: "awaiting_payment",
    subtotal_vnd: calculated.subtotal,
    shipping_fee_vnd: calculated.shippingFee,
    total_vnd: calculated.total,
    nutrition_snapshot: calculated.nutrition,
    people: safePeople,
    goal: input.goal || null,
    items: calculated.items.map((it, idx) => ({ id: idx + 1, ...it })),
    created_at: new Date().toISOString(),
    expires_at: expiresAt,
    cancel_reason: null,
    paid_at: null,
    cooking_at: null,
    packed_at: null,
    delivered_at: null
  };

  globalFallback._fallbackOrders!.set(orderId, record);
  await recordOrderEvent(orderId, null, "awaiting_payment", "customer", "Khách tạo đơn hàng");
  return { orderId, publicCode, publicToken, expiresAt };
}

type DbOrderRow = {
  id: string;
  public_token?: string | null;
  public_code: string;
  customer_name: string;
  phone: string;
  customer_email?: string | null;
  delivery_address: string;
  note?: string | null;
  status: string;
  shipping_fee_vnd?: number | null;
  total_vnd: number;
  nutrition_snapshot: Macros;
  people?: number | null;
  goal?: string | null;
  created_at: string;
  expires_at?: string | null;
  cancel_reason?: string | null;
  paid_at?: string | null;
  cooking_at?: string | null;
  packed_at?: string | null;
  delivered_at?: string | null;
};

type DbOrderItemRow = {
  id?: string | number;
  order_id?: string;
  dish_id: string;
  name_snapshot: string;
  unit_price_vnd: number;
  nutrition_snapshot: Macros & { grams?: number };
};

function mapOrderRow(order: DbOrderRow, items: DbOrderItemRow[]): OrderRecord {
  const itemSnapshots: OrderItemSnapshot[] = items.map((it) => ({
    id: it.id,
    dishId: it.dish_id,
    name: it.name_snapshot,
    grams: Number(it.nutrition_snapshot?.grams ?? 0),
    unitPrice: it.unit_price_vnd,
    nutrition: it.nutrition_snapshot
  }));

  return {
    id: order.id,
    public_token: order.public_token || order.id,
    public_code: order.public_code,
    customer_name: order.customer_name,
    phone: order.phone,
    customer_email: order.customer_email,
    delivery_address: order.delivery_address,
    note: order.note,
    status: order.status as OrderStatus,
    subtotal_vnd: order.total_vnd - (order.shipping_fee_vnd ?? 0),
    shipping_fee_vnd: order.shipping_fee_vnd ?? 0,
    total_vnd: order.total_vnd,
    nutrition_snapshot: order.nutrition_snapshot,
    people: order.people ? Number(order.people) : 1,
    goal: order.goal ?? null,
    items: itemSnapshots,
    created_at: order.created_at,
    expires_at: order.expires_at ?? null,
    cancel_reason: order.cancel_reason ?? null,
    paid_at: order.paid_at,
    cooking_at: order.cooking_at ?? null,
    packed_at: order.packed_at ?? null,
    delivered_at: order.delivered_at ?? null
  };
}

/**
 * Lấy danh sách đơn hàng (mới nhất trước), có thể lọc theo trạng thái
 */
export async function getAllOrders(statusFilter?: string): Promise<OrderRecord[]> {
  ensureDemoSeedLoaded();
  // Tự động kiểm tra và hủy các đơn awaiting_payment đã quá hạn
  await checkAndCancelExpiredOrders();

  const isPendingReview =
    statusFilter === "pending_review" ||
    statusFilter === "waiting_confirmation" ||
    statusFilter === "pending_verification";
  const normalizedFilter =
    statusFilter && statusFilter !== "all" && !isPendingReview ? statusFilter : undefined;

  if (isSupabaseConfigured()) {
    try {
      const supabase = createServerSupabaseClient();
      let query = supabase
        .from("orders")
        .select("id, public_token, public_code, customer_name, phone, customer_email, delivery_address, note, status, total_vnd, shipping_fee_vnd, nutrition_snapshot, created_at, paid_at, cooking_at, packed_at, delivered_at, expires_at, cancel_reason, people, goal")
        .order("created_at", { ascending: false });

      if (isPendingReview) {
        query = query.in("status", ["awaiting_payment", "pending_verification"]);
      } else if (normalizedFilter) {
        query = query.eq("status", normalizedFilter);
      }

      const { data: orders, error } = await query;
      if (!error && orders) {
        if (orders.length === 0) return [];
        const orderIds = orders.map((o) => o.id);
        const { data: items } = await supabase
          .from("order_items")
          .select("id, order_id, dish_id, name_snapshot, unit_price_vnd, quantity, nutrition_snapshot")
          .in("order_id", orderIds);

        const itemsByOrder = new Map<string, DbOrderItemRow[]>();
        for (const it of (items ?? []) as DbOrderItemRow[]) {
          const oid = it.order_id ?? "";
          const list = itemsByOrder.get(oid) ?? [];
          list.push(it);
          itemsByOrder.set(oid, list);
        }

        const mapped = (orders as DbOrderRow[]).map((order) =>
          mapOrderRow(order, itemsByOrder.get(order.id) ?? [])
        );

        if (isPendingReview) {
          mapped.sort((a, b) => {
            if (a.status === "pending_verification" && b.status !== "pending_verification") return -1;
            if (b.status === "pending_verification" && a.status !== "pending_verification") return 1;
            return b.created_at.localeCompare(a.created_at);
          });
        }

        return mapped;
      }
    } catch (err) {
      console.warn("Supabase getAllOrders error, using fallback:", err);
    }
  }

  let list = Array.from(globalFallback._fallbackOrders!.values());
  if (isPendingReview) {
    list = list.filter((o) => o.status === "awaiting_payment" || o.status === "pending_verification");
    list.sort((a, b) => {
      if (a.status === "pending_verification" && b.status !== "pending_verification") return -1;
      if (b.status === "pending_verification" && a.status !== "pending_verification") return 1;
      return b.created_at.localeCompare(a.created_at);
    });
    return list;
  }
  if (normalizedFilter) {
    list = list.filter((o) => o.status === normalizedFilter);
  }
  return list.sort((a, b) => b.created_at.localeCompare(a.created_at));
}

/**
 * Lấy chi tiết đơn hàng theo orderId (UUID)
 */
export async function getOrderById(orderId: string): Promise<OrderRecord | null> {
  ensureDemoSeedLoaded();
  if (isSupabaseConfigured()) {
    try {
      const supabase = createServerSupabaseClient();
      const [{ data: order }, { data: items }] = await Promise.all([
        supabase
          .from("orders")
          .select("id, public_token, public_code, customer_name, phone, customer_email, delivery_address, note, status, total_vnd, shipping_fee_vnd, nutrition_snapshot, created_at, paid_at, cooking_at, packed_at, delivered_at, expires_at, cancel_reason, people, goal")
          .eq("id", orderId)
          .maybeSingle(),
        supabase
          .from("order_items")
          .select("id, order_id, dish_id, name_snapshot, unit_price_vnd, quantity, nutrition_snapshot")
          .eq("order_id", orderId),
      ]);

      if (order) {
        return mapOrderRow(order as DbOrderRow, (items ?? []) as DbOrderItemRow[]);
      }
    } catch (err) {
      console.warn("Supabase getOrderById error, using fallback:", err);
    }
  }

  return globalFallback._fallbackOrders!.get(orderId) ?? null;
}

/**
 * Lấy chi tiết đơn hàng theo public_code (MHLN####)
 */
export async function getOrderByCode(code: string): Promise<OrderRecord | null> {
  ensureDemoSeedLoaded();
  if (isSupabaseConfigured()) {
    try {
      const supabase = createServerSupabaseClient();
      const { data: order } = await supabase
        .from("orders")
        .select("id, public_token, public_code, customer_name, phone, customer_email, delivery_address, note, status, total_vnd, shipping_fee_vnd, nutrition_snapshot, created_at, paid_at, cooking_at, packed_at, delivered_at, expires_at, cancel_reason, people, goal")
        .eq("public_code", code)
        .maybeSingle();

      if (order) {
        const { data: items } = await supabase
          .from("order_items")
          .select("id, order_id, dish_id, name_snapshot, unit_price_vnd, quantity, nutrition_snapshot")
          .eq("order_id", order.id);

        return mapOrderRow(order as DbOrderRow, (items ?? []) as DbOrderItemRow[]);
      }
    } catch (err) {
      console.warn("Supabase getOrderByCode error, using fallback:", err);
    }
  }

  for (const order of globalFallback._fallbackOrders!.values()) {
    if (order.public_code === code) return order;
  }
  return null;
}

/**
 * Lấy chi tiết đơn hàng theo public_token (nanoid 21 ký tự) cho route khách hàng
 */
export async function getOrderByPublicToken(token: string): Promise<OrderRecord | null> {
  ensureDemoSeedLoaded();
  await checkAndCancelExpiredOrders();

  if (isSupabaseConfigured()) {
    try {
      const supabase = createServerSupabaseClient();
      const { data: order } = await supabase
        .from("orders")
        .select("id, public_token, public_code, customer_name, phone, customer_email, delivery_address, note, status, total_vnd, shipping_fee_vnd, nutrition_snapshot, created_at, paid_at, cooking_at, packed_at, delivered_at, expires_at, cancel_reason, people, goal")
        .eq("public_token", token)
        .maybeSingle();

      if (order) {
        const { data: items } = await supabase
          .from("order_items")
          .select("id, order_id, dish_id, name_snapshot, unit_price_vnd, quantity, nutrition_snapshot")
          .eq("order_id", order.id);

        return mapOrderRow(order as DbOrderRow, (items ?? []) as DbOrderItemRow[]);
      }
    } catch (err) {
      console.warn("Supabase getOrderByPublicToken error, using fallback:", err);
    }
  }

  for (const order of globalFallback._fallbackOrders!.values()) {
    if (order.public_token === token) return order;
  }
  return null;
}

/**
 * Đếm số lượng đơn hàng đang ở trạng thái 'awaiting_payment' của một số điện thoại
 */
export async function countAwaitingOrdersByPhone(phone: string): Promise<number> {
  const normalizedPhone = phone.trim();
  let dbCount = 0;

  if (isSupabaseConfigured()) {
    try {
      const supabase = createServerSupabaseClient();
      const { count, error } = await supabase
        .from("orders")
        .select("*", { count: "exact", head: true })
        .eq("phone", normalizedPhone)
        .eq("status", "awaiting_payment");

      if (!error && typeof count === "number") {
        dbCount = count;
      }
    } catch (err) {
      console.warn("Supabase countAwaitingOrdersByPhone error, using fallback:", err);
    }
  }

  ensureDemoSeedLoaded();
  let fallbackCount = 0;
  for (const order of globalFallback._fallbackOrders!.values()) {
    if (order.phone.trim() === normalizedPhone && order.status === "awaiting_payment") {
      fallbackCount++;
    }
  }
  return Math.max(dbCount, fallbackCount);
}

/**
 * Ghi vết sự kiện thay đổi trạng thái đơn hàng vào order_events
 */
export async function recordOrderEvent(
  orderId: string,
  fromStatus: OrderStatus | string | null,
  toStatus: OrderStatus | string,
  actor: "customer" | "admin" | "system" | string = "system",
  note?: string | null
): Promise<void> {
  const event: OrderEvent = {
    id: crypto.randomUUID(),
    order_id: orderId,
    from_status: (fromStatus as OrderStatus) || null,
    to_status: toStatus as OrderStatus,
    actor,
    note: note || null,
    created_at: new Date().toISOString(),
  };

  if (!globalFallback._fallbackOrderEvents) {
    globalFallback._fallbackOrderEvents = [];
  }
  globalFallback._fallbackOrderEvents.push(event);

  if (isSupabaseConfigured()) {
    try {
      const supabase = createServerSupabaseClient();
      await supabase.from("order_events").insert({
        id: event.id,
        order_id: event.order_id,
        from_status: event.from_status,
        to_status: event.to_status,
        actor: event.actor,
        note: event.note,
        created_at: event.created_at,
      });
    } catch (err) {
      console.warn("Supabase recordOrderEvent failed:", err);
    }
  }
}

/**
 * Lấy lịch sử sự kiện của đơn hàng
 */
export async function getOrderEvents(orderId: string): Promise<OrderEvent[]> {
  ensureDemoSeedLoaded();
  if (isSupabaseConfigured()) {
    try {
      const supabase = createServerSupabaseClient();
      const { data, error } = await supabase
        .from("order_events")
        .select("id, order_id, from_status, to_status, actor, note, created_at")
        .eq("order_id", orderId)
        .order("created_at", { ascending: true });
      if (!error && data) {
        return data as OrderEvent[];
      }
    } catch (err) {
      console.warn("Supabase getOrderEvents error:", err);
    }
  }

  return (globalFallback._fallbackOrderEvents ?? []).filter((e) => e.order_id === orderId);
}

/**
 * Kiểm tra và tự động hủy các đơn awaiting_payment đã quá hạn PAYMENT_WINDOW_MIN.
 * TUYỆT ĐỐI KHÔNG tự hủy đơn ở trạng thái pending_verification.
 */
export async function checkAndCancelExpiredOrders(): Promise<number> {
  ensureDemoSeedLoaded();
  const nowIso = new Date().toISOString();
  let cancelledCount = 0;

  for (const order of globalFallback._fallbackOrders!.values()) {
    // Chỉ hủy đơn awaiting_payment quá hạn!
    if (order.status === "awaiting_payment" && order.expires_at && order.expires_at <= nowIso) {
      order.status = "cancelled";
      order.cancel_reason = "expired";
      cancelledCount++;
      await recordOrderEvent(order.id, "awaiting_payment", "cancelled", "system", "Hết hạn thanh toán");
    }
  }

  if (isSupabaseConfigured()) {
    try {
      const supabase = createServerSupabaseClient();
      const { data: expiredOrders } = await supabase
        .from("orders")
        .select("id")
        .eq("status", "awaiting_payment")
        .lte("expires_at", nowIso);

      if (expiredOrders && expiredOrders.length > 0) {
        for (const exp of expiredOrders) {
          const { error } = await supabase
            .from("orders")
            .update({ status: "cancelled", cancel_reason: "expired" })
            .eq("id", exp.id)
            .eq("status", "awaiting_payment");
          if (!error) {
            cancelledCount++;
            await recordOrderEvent(exp.id, "awaiting_payment", "cancelled", "system", "Hết hạn thanh toán");
          }
        }
      }
    } catch (err) {
      console.warn("Supabase checkAndCancelExpiredOrders error:", err);
    }
  }

  return cancelledCount;
}

const ALLOWED_STATUS_TRANSITIONS: Partial<Record<OrderStatus, OrderStatus[]>> = {
  awaiting_payment: ["pending_verification", "paid", "cancelled"],
  pending_verification: ["paid"],
  paid: ["cooking"],
  cooking: ["packed"],
  packed: ["delivered"],
  cancelled: ["paid"], // Chỉ khi cancel_reason === 'expired' và do admin khôi phục
};

const STATUS_TIMESTAMP_FIELD: Partial<
  Record<OrderStatus, "paid_at" | "cooking_at" | "packed_at" | "delivered_at">
> = {
  paid: "paid_at",
  cooking: "cooking_at",
  packed: "packed_at",
  delivered: "delivered_at"
};

/**
 * Chuyển trạng thái đơn hàng (State machine) có kiểm tra điều kiện, chống trùng (optimistic lock),
 * ghi nhận actor ('admin', 'customer', 'system') và lưu vết vào order_events.
 */
export async function transitionOrderStatus(
  orderId: string,
  newStatus: OrderStatus,
  options?: {
    actor?: "admin" | "customer" | "system" | string;
    note?: string;
    cancelReason?: string;
    expectedCurrentStatuses?: OrderStatus[];
  }
): Promise<{ ok: boolean; conflict?: boolean; error?: string; order?: OrderRecord }> {
  const current = await getOrderById(orderId);
  if (!current) {
    return { ok: false, error: "Không tìm thấy đơn hàng." };
  }

  const fromStatus = current.status;

  // Chống trùng: kiểm tra expectedCurrentStatuses nếu có yêu cầu
  if (
    options?.expectedCurrentStatuses &&
    options.expectedCurrentStatuses.length > 0 &&
    !options.expectedCurrentStatuses.includes(fromStatus)
  ) {
    return {
      ok: false,
      conflict: true,
      error: `Đơn hàng đã được đổi sang trạng thái "${fromStatus}" trước đó (409 Conflict).`,
    };
  }

  // Kiểm tra bảng chuyển trạng thái hợp lệ
  const allowed = ALLOWED_STATUS_TRANSITIONS[fromStatus] ?? [];
  if (!allowed.includes(newStatus)) {
    return {
      ok: false,
      conflict: true,
      error: `Không thể chuyển trạng thái từ "${fromStatus}" sang "${newStatus}".`,
    };
  }

  // Khôi phục đơn: nếu từ 'cancelled' sang 'paid', bắt buộc cancel_reason phải là 'expired'
  if (fromStatus === "cancelled" && newStatus === "paid") {
    if (current.cancel_reason !== "expired") {
      return {
        ok: false,
        error: "Chỉ có thể khôi phục các đơn hàng bị hủy do hết hạn (expired).",
      };
    }
  }

  const actor = options?.actor ?? "system";
  const now = new Date().toISOString();
  const tsField = STATUS_TIMESTAMP_FIELD[newStatus];

  const updatedCancelReason =
    newStatus === "cancelled"
      ? options?.cancelReason ?? current.cancel_reason ?? "other"
      : null;

  const payload: Record<string, unknown> = {
    status: newStatus,
    cancel_reason: updatedCancelReason,
  };
  if (tsField) {
    payload[tsField] = now;
  }

  if (isSupabaseConfigured()) {
    try {
      const supabase = createServerSupabaseClient();
      let query = supabase.from("orders").update(payload).eq("id", orderId);
      if (options?.expectedCurrentStatuses && options.expectedCurrentStatuses.length > 0) {
        query = query.in("status", options.expectedCurrentStatuses);
      }
      const { data, error } = await query.select("id, status").maybeSingle();
      if (error) throw error;
      if (!data) {
        return {
          ok: false,
          conflict: true,
          error: "Trạng thái đơn hàng đã bị thay đổi bởi thao tác khác (409 Conflict).",
        };
      }
    } catch (err) {
      console.warn("Supabase transitionOrderStatus error:", err);
    }
  }

  const fallback = globalFallback._fallbackOrders!.get(orderId);
  if (fallback) {
    fallback.status = newStatus;
    fallback.cancel_reason = updatedCancelReason;
    if (tsField) {
      fallback[tsField] = now;
    }
  }

  const updatedOrder: OrderRecord = {
    ...current,
    status: newStatus,
    cancel_reason: updatedCancelReason,
    ...(tsField ? { [tsField]: now } : {}),
  };

  const defaultNote =
    fromStatus === "cancelled" && newStatus === "paid"
      ? "Khôi phục và xác nhận đã nhận tiền"
      : undefined;

  await recordOrderEvent(orderId, fromStatus, newStatus, actor, options?.note || defaultNote);

  return { ok: true, order: updatedOrder };
}

/**
 * Cập nhật trạng thái đơn hàng có kiểm tra luồng chuyển hợp lệ và ghi timestamp
 */
export async function updateOrderStatusWithTimestamp(
  orderId: string,
  newStatus: OrderStatus,
  options?: { actor?: string; note?: string; expectedCurrentStatuses?: OrderStatus[] }
): Promise<{ ok: boolean; conflict?: boolean; error?: string; order?: OrderRecord }> {
  return transitionOrderStatus(orderId, newStatus, {
    actor: options?.actor ?? "admin",
    note: options?.note,
    expectedCurrentStatuses: options?.expectedCurrentStatuses,
  });
}

/**
 * Cập nhật trạng thái đơn hàng (ví dụ sang 'pending_verification')
 */
export async function updateOrderStatus(
  orderId: string,
  newStatus: OrderStatus,
  options?: { actor?: string; note?: string; expectedCurrentStatuses?: OrderStatus[] }
): Promise<boolean> {
  const res = await transitionOrderStatus(orderId, newStatus, {
    actor: options?.actor ?? (newStatus === "pending_verification" ? "customer" : "admin"),
    note: options?.note,
    expectedCurrentStatuses: options?.expectedCurrentStatuses,
  });
  return res.ok;
}

/**
 * Lấy danh sách nguyên liệu + chất gây dị ứng của món ăn để đóng gói snapshot
 */
export async function getDishIngredientsSnapshot(
  dishId: string
): Promise<Array<{ name: string; rawG: number; allergens: string[] }>> {
  if (isSupabaseConfigured()) {
    try {
      const supabase = createServerSupabaseClient();
      const { data, error } = await supabase
        .from("dish_ingredients")
        .select("raw_g, ingredients(name, allergens)")
        .eq("dish_id", dishId);

      if (!error && data && data.length > 0) {
        return data.map((row) => {
          const ing = row.ingredients as unknown as {
            name?: string;
            allergens?: string[];
          } | null;
          return {
            name: ing?.name ?? "",
            rawG: Number(row.raw_g ?? 0),
            allergens: Array.isArray(ing?.allergens) ? ing.allergens : []
          };
        });
      }
    } catch (err) {
      console.warn("Supabase getDishIngredientsSnapshot error, using fallback:", err);
    }
  }

  const fallbackDish = getFallbackDishes().find((d) => d.id === dishId);
  if (!fallbackDish) return [];

  return fallbackDish.recipe
    .map((r) => {
      const ing = SEED_INGREDIENTS[r.ingredientId];
      if (!ing) return null;
      return {
        name: ing.name,
        rawG: r.raw_g,
        allergens: [...ing.allergens]
      };
    })
    .filter((x): x is { name: string; rawG: number; allergens: string[] } => x !== null);
}





// ========== COOKING BATCHES & PORTIONS FALLBACK ==========
export function getAllCookingBatches(): CookingBatch[] {
  ensureDemoSeedLoaded();
  return Array.from(globalFallbackBatches._fallbackBatches!.values()).sort(
    (a, b) => b.cookedAt.localeCompare(a.cookedAt)
  );
}

export function getCookingBatch(id: string): CookingBatch | null {
  ensureDemoSeedLoaded();
  return globalFallbackBatches._fallbackBatches!.get(id) ?? null;
}

export async function saveCookingBatch(input: Omit<CookingBatch, 'id'>): Promise<CookingBatch> {
  ensureDemoSeedLoaded();
  const id = crypto.randomUUID();
  const batch: CookingBatch = { id, ...input };
  if (isSupabaseConfigured()) {
    try {
      const supabase = createServerSupabaseClient();
      const { data, error } = await supabase.from('cooking_batches').insert({
        id,
        dish_id: input.dishId,
        dish_name: input.dishName,
        lot_code: input.lotCode,
        supplier_note: input.supplierNote ?? null,
        cooked_yield_g: input.cookedYieldG,
        cooked_at: input.cookedAt,
      }).select('*').single();
      if (!error && data) {
        globalFallbackBatches._fallbackBatches!.set(id, batch);
        return batch;
      }
    } catch (e) { console.warn('saveCookingBatch supabase error', e); }
  }
  globalFallbackBatches._fallbackBatches!.set(id, batch);
  return batch;
}

type DbNutritionSnapshotRow = {
  id: string;
  order_id: string;
  order_item_id: number;
  qr_code: string;
  dish_name: string;
  cooked_at: string;
  cooked_batch_id?: string | null;
  actual_grams: number | string;
  kcal: number | string;
  protein_g: number | string;
  carbs_g: number | string;
  fat_g: number | string;
  ingredients?: Array<{ name: string; rawG?: number; raw_g?: number; allergens?: string[] }>;
  allergens?: string[];
  source_note?: string | null;
  lot_code?: string | null;
  people?: number | null;
  per_person_estimate?: Macros | null;
  packed_at: string;
};

function mapNutritionSnapshotRow(row: DbNutritionSnapshotRow): PortionSnapshot {
  return {
    id: row.id,
    orderId: row.order_id,
    orderItemId: Number(row.order_item_id),
    qrCode: row.qr_code,
    dishName: row.dish_name,
    cookedAt: row.cooked_at,
    cookedBatchId: row.cooked_batch_id ?? null,
    actualGrams: Number(row.actual_grams),
    kcal: Number(row.kcal),
    proteinG: Number(row.protein_g),
    carbsG: Number(row.carbs_g),
    fatG: Number(row.fat_g),
    ingredients: Array.isArray(row.ingredients)
      ? row.ingredients.map((ing) => ({
          name: ing.name ?? "",
          rawG: Number(ing.rawG ?? ing.raw_g ?? 0),
          allergens: Array.isArray(ing.allergens) ? ing.allergens : []
        }))
      : [],
    allergens: Array.isArray(row.allergens) ? row.allergens : [],
    sourceNote: row.source_note ?? null,
    lotCode: row.lot_code ?? null,
    people: row.people ? Number(row.people) : 1,
    per_person_estimate: (row.per_person_estimate as Macros) ?? null,
    packedAt: row.packed_at
  };
}

export async function getPortionsByOrder(orderId: string): Promise<PortionSnapshot[]> {
  ensureDemoSeedLoaded();
  if (isSupabaseConfigured()) {
    try {
      const supabase = createServerSupabaseClient();
      const { data, error } = await supabase
        .from("nutrition_snapshots")
        .select("*")
        .eq("order_id", orderId)
        .order("packed_at", { ascending: true });

      if (!error && data) {
        return (data as DbNutritionSnapshotRow[]).map(mapNutritionSnapshotRow);
      }
    } catch (e) {
      console.warn("getPortionsByOrder supabase error, using fallback:", e);
    }
  }

  return Array.from(globalFallbackBatches._fallbackPortions!.values()).filter(
    (p) => p.orderId === orderId
  );
}

export async function getPortionByQrCode(qrCode: string): Promise<PortionSnapshot | null> {
  ensureDemoSeedLoaded();
  if (isSupabaseConfigured()) {
    try {
      const supabase = createServerSupabaseClient();
      const { data, error } = await supabase
        .from("nutrition_snapshots")
        .select("*")
        .eq("qr_code", qrCode)
        .maybeSingle();

      if (!error && data) {
        return mapNutritionSnapshotRow(data as DbNutritionSnapshotRow);
      }
    } catch (e) {
      console.warn("getPortionByQrCode supabase error, using fallback:", e);
    }
  }

  for (const portion of globalFallbackBatches._fallbackPortions!.values()) {
    if (portion.qrCode === qrCode) return portion;
  }
  return null;
}

export async function savePortionSnapshot(input: Omit<PortionSnapshot, 'id'>): Promise<PortionSnapshot> {
  ensureDemoSeedLoaded();
  const id = crypto.randomUUID();
  const portion: PortionSnapshot = { id, ...input };
  if (isSupabaseConfigured()) {
    try {
      const supabase = createServerSupabaseClient();
      await supabase.from('nutrition_snapshots').insert({
        id,
        order_id: input.orderId,
        order_item_id: input.orderItemId,
        qr_code: input.qrCode,
        dish_name: input.dishName,
        cooked_at: input.cookedAt,
        cooked_batch_id: input.cookedBatchId ?? null,
        actual_grams: input.actualGrams,
        kcal: input.kcal,
        protein_g: input.proteinG,
        carbs_g: input.carbsG,
        fat_g: input.fatG,
        ingredients: input.ingredients,
        allergens: input.allergens,
        source_note: input.sourceNote ?? null,
        lot_code: input.lotCode ?? null,
        people: input.people ?? 1,
        per_person_estimate: input.per_person_estimate ?? null,
        packed_at: input.packedAt,
      });
    } catch (e) { console.warn('savePortionSnapshot supabase error', e); }
  }
  globalFallbackBatches._fallbackPortions!.set(id, portion);
  return portion;
}
