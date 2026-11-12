"use server";
import { revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "@/lib/supabase/server";

type Draft = { dishId: string; portionLimit: number; stepG: number; minG: number; maxG: number; grams: { balanced: number; light: number; protein: number } };
const goals = ["balanced", "light", "protein"] as const;
function readDraft(formData: FormData) {
  const date = String(formData.get("menu_date") ?? ""); const draft = JSON.parse(String(formData.get("draft") ?? "[]")) as Draft[];
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !draft.length || new Set(draft.map((x) => x.dishId)).size !== draft.length) throw new Error("Ngày hoặc món bán không hợp lệ.");
  for (const item of draft) { if (!item.dishId || !Number.isInteger(item.portionLimit) || item.portionLimit < 1 || ![item.stepG, item.minG, item.maxG, ...goals.map((goal) => item.grams[goal])].every(Number.isFinite) || item.stepG <= 0 || item.minG <= 0 || item.maxG < item.minG || goals.some((goal) => item.grams[goal] < item.minG || item.grams[goal] > item.maxG)) throw new Error("Định lượng hoặc giới hạn món không hợp lệ."); }
  return { date, draft };
}
export async function saveDailyMenu(formData: FormData) {
  const { date, draft } = readDraft(formData); const db = createServerSupabaseClient();
  const { data: dishes, error: dishError } = await db.from("dishes").select("id,approved").in("id", draft.map((item) => item.dishId));
  if (dishError || dishes?.length !== draft.length || dishes.some((dish) => !dish.approved)) throw new Error("Chỉ có thể đưa món đã duyệt vào thực đơn.");
  let { data: menuDay } = await db.from("menu_days").select("id").eq("menu_date", date).maybeSingle();
  if (!menuDay) { const { data, error } = await db.from("menu_days").insert({ menu_date: date, published: false }).select("id").single(); if (error || !data) throw new Error(error?.message ?? "Không thể tạo ngày bán."); menuDay = data; } else { await db.from("menu_days").update({ published: false }).eq("id", menuDay.id); await db.from("menu_dishes").delete().eq("menu_day_id", menuDay.id); await db.from("combos").delete().eq("menu_day_id", menuDay.id); }
  const { error: menuDishError } = await db.from("menu_dishes").insert(draft.map((item) => ({ menu_day_id: menuDay.id, dish_id: item.dishId, portion_limit: item.portionLimit, step_g: item.stepG, min_g: item.minG, max_g: item.maxG })));
  if (menuDishError) throw new Error(menuDishError.message);
  const { data: combos, error: comboError } = await db.from("combos").insert(goals.map((goal) => ({ menu_day_id: menuDay.id, goal }))).select("id,goal");
  if (comboError || !combos || combos.length !== 3) throw new Error(comboError?.message ?? "Không thể tạo ba combo.");
  const comboItems = combos.flatMap((combo) => draft.map((item) => ({ combo_id: combo.id, dish_id: item.dishId, grams: item.grams[combo.goal as keyof Draft["grams"]] })));
  const { error: itemError } = await db.from("combo_items").insert(comboItems); if (itemError) throw new Error(itemError.message);
  revalidatePath("/admin/menu");
}
export async function publishDailyMenu(formData: FormData) {
  const date = String(formData.get("menu_date") ?? ""); const db = createServerSupabaseClient(); const { data: day } = await db.from("menu_days").select("id").eq("menu_date", date).maybeSingle(); if (!day) throw new Error("Chưa tạo thực đơn cho ngày này.");
  const { data: selections } = await db.from("menu_dishes").select("dish_id").eq("menu_day_id", day.id); const dishIds = selections?.map((row) => row.dish_id) ?? [];
  const { data: dishes } = dishIds.length ? await db.from("dishes").select("id,approved").in("id", dishIds) : { data: [] as Array<{ id: string; approved: boolean }> };
  const { count } = await db.from("combos").select("id", { count: "exact", head: true }).eq("menu_day_id", day.id);
  if (!dishIds.length || dishes?.length !== dishIds.length || dishes.some((dish) => !dish.approved) || count !== 3) throw new Error("Chỉ công bố khi mọi món đã duyệt và có đúng ba combo.");
  const { error } = await db.from("menu_days").update({ published: true }).eq("id", day.id); if (error) throw new Error(error.message); revalidatePath("/admin/menu"); revalidatePath("/api/menu/today");
}
