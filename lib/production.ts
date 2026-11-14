/**
 * lib/production.ts
 * Quản lý tổng hợp định lượng chế biến bếp, phân rã nguyên liệu thô và ước tính khẩu phần.
 * 
 * QUY TẮC CỐT LÕI:
 * - Định lượng chế biến được lấy trực tiếp từ `order_items.grams` (tổng khối lượng khách đặt).
 * - TUYỆT ĐỐI KHÔNG nhân số người (people) ở bất kỳ phép tính sản xuất hay nguyên liệu nào.
 * - Trường `people` và `per_person_estimate` chỉ mang tính chất tham khảo cho người dùng/bếp.
 */

import type { OrderRecord, Macros } from "./types";
import demoSeed from "./demo-seed.json";

const SEED_INGREDIENTS: Record<string, { id: string; name: string; allergens: string[] }> =
  Object.fromEntries(demoSeed.ingredients.map((i) => [i.id, i]));

function round2(val: number): number {
  return Math.round(val * 100) / 100;
}

export type DishProductionItem = {
  dishId: string;
  dishName: string;
  totalGrams: number;
  itemCount: number;
};

export type IngredientRequirement = {
  ingredientId: string;
  name: string;
  totalRawG: number;
};

/**
 * Tổng hợp tổng khối lượng cần chế biến theo từng món ăn từ danh sách đơn hàng.
 * grams được lấy trực tiếp từ order_items, không nhân people.
 */
export function aggregateDishProduction(orders: OrderRecord[]): DishProductionItem[] {
  const map = new Map<string, DishProductionItem>();

  for (const order of orders) {
    // Không tính các đơn đã hủy
    if (order.status === "cancelled") continue;

    for (const item of order.items) {
      const existing = map.get(item.dishId);
      if (existing) {
        existing.totalGrams += item.grams;
        existing.itemCount += 1;
      } else {
        map.set(item.dishId, {
          dishId: item.dishId,
          dishName: item.name,
          totalGrams: item.grams,
          itemCount: 1,
        });
      }
    }
  }

  return Array.from(map.values()).sort((a, b) => b.totalGrams - a.totalGrams);
}

/**
 * Bản đồ công thức chế biến của các món trong hệ thống
 */
function getDefaultRecipeMap(): Map<
  string,
  { yieldG: number; recipe: Array<{ ingredientId: string; raw_g: number }> }
> {
  const map = new Map();
  for (const d of demoSeed.dishes) {
    map.set(d.id, {
      yieldG: d.yield_g,
      recipe: d.recipe,
    });
  }
  return map;
}

/**
 * Tổng hợp tổng nhu cầu nguyên liệu thô cần chuẩn bị cho ca bếp.
 * Nguyên liệu = grams_đặt × (raw_g / yield_g). Không bị thay đổi bởi trường people.
 */
export function aggregateIngredientRequirements(
  orders: OrderRecord[],
  customRecipes?: Map<
    string,
    { yieldG: number; recipe: Array<{ ingredientId: string; raw_g: number }> }
  >
): IngredientRequirement[] {
  const recipeMap = customRecipes ?? getDefaultRecipeMap();
  const rawMap = new Map<string, { ingredientId: string; name: string; totalRawG: number }>();

  for (const order of orders) {
    if (order.status === "cancelled") continue;

    for (const item of order.items) {
      const dishMeta = recipeMap.get(item.dishId);
      if (!dishMeta || dishMeta.yieldG <= 0) continue;

      for (const r of dishMeta.recipe) {
        const ing = SEED_INGREDIENTS[r.ingredientId];
        const ingName = ing ? ing.name : r.ingredientId;
        const neededRaw = (item.grams * r.raw_g) / dishMeta.yieldG;

        const existing = rawMap.get(r.ingredientId);
        if (existing) {
          existing.totalRawG += neededRaw;
        } else {
          rawMap.set(r.ingredientId, {
            ingredientId: r.ingredientId,
            name: ingName,
            totalRawG: neededRaw,
          });
        }
      }
    }
  }

  return Array.from(rawMap.values())
    .map((item) => ({
      ...item,
      totalRawG: round2(item.totalRawG),
    }))
    .sort((a, b) => b.totalRawG - a.totalRawG);
}

/**
 * Tính bình quân ước tính mỗi người nếu chia đều (Chỉ để hiển thị tham khảo)
 */
export function calculatePerPersonEstimate(
  totalNutrition: Macros,
  people: number = 1
): Macros {
  const safePeople = Math.max(1, Math.min(10, Math.round(people || 1)));
  return {
    kcal: round2(totalNutrition.kcal / safePeople),
    protein: round2(totalNutrition.protein / safePeople),
    carbs: round2(totalNutrition.carbs / safePeople),
    fat: round2(totalNutrition.fat / safePeople),
  };
}
