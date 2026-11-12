"use server";
import { revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { calcDish } from "@/lib/nutrition";

type Row = { ingredientId: string; rawG: number };
export async function createDish(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim(); const price = Number(formData.get("price_vnd")); const yieldG = Number(formData.get("yield_g")); const imageUrl = String(formData.get("image_url") ?? "").trim() || null;
  const rows = JSON.parse(String(formData.get("items") ?? "[]")) as Row[];
  if (!name || !Number.isInteger(price) || price <= 0 || !Number.isFinite(yieldG) || yieldG <= 0 || !rows.length || rows.some((row) => !row.ingredientId || row.rawG <= 0)) throw new Error("Vui lòng nhập đủ món, giá, công thức và khối lượng thành phẩm.");
  const db = createServerSupabaseClient();
  const { data: ingredients, error: ingredientsError } = await db.from("ingredients").select("id,kcal_per100,protein_per100,carbs_per100,fat_per100").in("id", rows.map((row) => row.ingredientId));
  if (ingredientsError || ingredients?.length !== new Set(rows.map((row) => row.ingredientId)).size) throw new Error("Có nguyên liệu không tồn tại.");
  const byId = new Map(ingredients.map((ingredient) => [ingredient.id, ingredient]));
  calcDish(rows.map((row) => { const i = byId.get(row.ingredientId)!; return { raw_g: row.rawG, per100: { kcal: Number(i.kcal_per100), protein: Number(i.protein_per100), carbs: Number(i.carbs_per100), fat: Number(i.fat_per100) } }; }), yieldG);
  const { data: dish, error } = await db.from("dishes").insert({ name, price_vnd: price, image_url: imageUrl, yield_g: yieldG }).select("id").single(); if (error || !dish) throw new Error(error?.message ?? "Không thể tạo món.");
  const { error: itemError } = await db.from("dish_ingredients").insert(rows.map((row) => ({ dish_id: dish.id, ingredient_id: row.ingredientId, raw_g: row.rawG }))); if (itemError) throw new Error(itemError.message);
  revalidatePath("/admin/dishes");
}
export async function approveDish(formData: FormData) { const id = String(formData.get("id")); if (!id) throw new Error("Thiếu mã món."); const { error } = await createServerSupabaseClient().from("dishes").update({ approved: true }).eq("id", id); if (error) throw new Error(error.message); revalidatePath("/admin/dishes"); }
