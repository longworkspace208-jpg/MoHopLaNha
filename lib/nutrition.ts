import type { CartLine, Nutrition } from "./types";
import { findDish } from "./menu";

export type Macros = { kcal: number; protein: number; carbs: number; fat: number };
export type RecipeItem = { raw_g: number; per100: Macros };
const macroKeys: Array<keyof Macros> = ["kcal", "protein", "carbs", "fat"];

/** Nutrients per 100 g of cooked dish. All input nutrients are per 100 g raw ingredient. */
export function calcDish(items: RecipeItem[], yield_g: number): Macros {
  if (!Number.isFinite(yield_g) || yield_g <= 0) throw new Error("Khối lượng thành phẩm phải lớn hơn 0.");
  const result: Macros = { kcal: 0, protein: 0, carbs: 0, fat: 0 };
  for (const item of items) {
    if (!Number.isFinite(item.raw_g) || item.raw_g < 0) throw new Error("Khối lượng nguyên liệu không hợp lệ.");
    for (const key of macroKeys) result[key] += (item.raw_g * item.per100[key]) / 100;
  }
  for (const key of macroKeys) result[key] = (result[key] / yield_g) * 100;
  return result;
}

/** Converts a nutritional profile per 100 g into one portion in grams. */
export function calcPortion(per100: Macros, grams: number): Macros {
  if (!Number.isFinite(grams) || grams < 0) throw new Error("Khối lượng phần ăn không hợp lệ.");
  return { kcal: per100.kcal * grams / 100, protein: per100.protein * grams / 100, carbs: per100.carbs * grams / 100, fat: per100.fat * grams / 100 };
}

export type CalculatedOrder = { items: Array<{ dishId: string; name: string; unitPrice: number; quantity: number; subtotal: number; nutrition: Nutrition }>; total: number; nutrition: Nutrition };
const blank = (): Nutrition => ({ kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 });

/** Calculates exclusively from trusted menu data. Values are stored as the immutable snapshot at checkout. */
export function calculateOrder(lines: CartLine[]): CalculatedOrder {
  if (!Array.isArray(lines) || lines.length === 0) throw new Error("Giỏ hàng đang trống.");
  const nutrition = blank();
  const items = lines.map(({ dishId, quantity }) => {
    const dish = findDish(dishId);
    if (!dish || !Number.isInteger(quantity) || quantity < 1 || quantity > 20) throw new Error("Món ăn không hợp lệ.");
    for (const key of Object.keys(nutrition) as Array<keyof Nutrition>) nutrition[key] += dish.nutrition[key] * quantity;
    return { dishId, name: dish.name, unitPrice: dish.price, quantity, subtotal: dish.price * quantity, nutrition: { ...dish.nutrition } };
  });
  return { items, total: items.reduce((sum, item) => sum + item.subtotal, 0), nutrition };
}
