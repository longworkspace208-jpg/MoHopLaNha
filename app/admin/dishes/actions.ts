"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { requireAdmin } from "@/lib/admin-auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { calcDish } from "@/lib/nutrition";
import { todayInVietnam } from "@/lib/menu-cache";

type Row = { ingredientId: string; rawG: number };

export async function createDish(formData: FormData) {
  await requireAdmin();
  const name = String(formData.get("name") ?? "").trim();
  const price = Number(formData.get("price_vnd"));
  const yieldG = Number(formData.get("yield_g"));
  const imageUrl = String(formData.get("image_url") ?? "").trim() || null;
  const rows = JSON.parse(String(formData.get("items") ?? "[]")) as Row[];

  if (
    !name ||
    !Number.isInteger(price) ||
    price <= 0 ||
    !Number.isFinite(yieldG) ||
    yieldG <= 0 ||
    !rows.length ||
    rows.some((row) => !row.ingredientId || row.rawG <= 0)
  ) {
    throw new Error("Vui lòng nhập đủ món, giá, công thức và khối lượng thành phẩm.");
  }

  const db = createServerSupabaseClient();
  const { data: ingredients, error: ingredientsError } = await db
    .from("ingredients")
    .select("id,kcal_per100,protein_per100,carbs_per100,fat_per100")
    .in("id", rows.map((row) => row.ingredientId));

  if (
    ingredientsError ||
    ingredients?.length !== new Set(rows.map((row) => row.ingredientId)).size
  ) {
    throw new Error("Có nguyên liệu không tồn tại.");
  }

  const byId = new Map(ingredients.map((ingredient) => [ingredient.id, ingredient]));
  calcDish(
    rows.map((row) => {
      const i = byId.get(row.ingredientId)!;
      return {
        raw_g: row.rawG,
        per100: {
          kcal: Number(i.kcal_per100),
          protein: Number(i.protein_per100),
          carbs: Number(i.carbs_per100),
          fat: Number(i.fat_per100),
        },
      };
    }),
    yieldG
  );

  const { data: dish, error } = await db
    .from("dishes")
    .insert({
      name,
      price_vnd: price,
      image_url: imageUrl,
      yield_g: yieldG,
      approved: true,
    })
    .select("id")
    .single();

  if (error || !dish) throw new Error(error?.message ?? "Không thể tạo món.");

  const { error: itemError } = await db
    .from("dish_ingredients")
    .insert(
      rows.map((row) => ({
        dish_id: dish.id,
        ingredient_id: row.ingredientId,
        raw_g: row.rawG,
      }))
    );

  if (itemError) throw new Error(itemError.message);

  // Tự động gắn món vào thực đơn hôm nay nếu menu đã khởi tạo
  const today = todayInVietnam();
  const { data: todayMenuDay } = await db
    .from("menu_days")
    .select("id")
    .eq("menu_date", today)
    .maybeSingle();

  if (todayMenuDay) {
    await db.from("menu_dishes").upsert(
      {
        menu_day_id: todayMenuDay.id,
        dish_id: dish.id,
        portion_limit: 50,
        step_g: 50,
        min_g: 100,
        max_g: 600,
      },
      { onConflict: "menu_day_id,dish_id", ignoreDuplicates: true }
    );
  }

  revalidateTag("menu");
  revalidatePath("/menu");
  revalidatePath("/api/menu/today");
  revalidatePath("/admin/dishes");
  revalidatePath("/admin/menu");
}

export async function approveDish(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id"));
  if (!id) throw new Error("Thiếu mã món.");
  const db = createServerSupabaseClient();
  const { error } = await db
    .from("dishes")
    .update({ approved: true })
    .eq("id", id);
  if (error) throw new Error(error.message);

  const today = todayInVietnam();
  const { data: todayMenuDay } = await db
    .from("menu_days")
    .select("id")
    .eq("menu_date", today)
    .maybeSingle();

  if (todayMenuDay) {
    await db.from("menu_dishes").upsert(
      {
        menu_day_id: todayMenuDay.id,
        dish_id: id,
        portion_limit: 50,
        step_g: 50,
        min_g: 100,
        max_g: 600,
      },
      { onConflict: "menu_day_id,dish_id", ignoreDuplicates: true }
    );
  }

  revalidateTag("menu");
  revalidatePath("/menu");
  revalidatePath("/api/menu/today");
  revalidatePath("/admin/dishes");
  revalidatePath("/admin/menu");
}
