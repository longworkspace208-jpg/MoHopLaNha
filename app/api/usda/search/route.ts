import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const value = (nutrients: Array<{ nutrientName?: string; value?: number }> | undefined, name: string) => nutrients?.find((n) => n.nutrientName?.toLowerCase().includes(name))?.value ?? 0;
export async function GET(request: Request) {
  if (!await isAdmin()) return NextResponse.json({ error: "Không có quyền." }, { status: 401 });
  const query = new URL(request.url).searchParams.get("q")?.trim();
  if (!query) return NextResponse.json({ error: "Thiếu từ khóa tìm kiếm." }, { status: 400 });
  const db = createServerSupabaseClient();
  const { data: cached } = await db.from("ingredients").select("id,name,kcal_per100,protein_per100,carbs_per100,fat_per100,allergens,usda_fdc_id,source").ilike("name", query).limit(10);
  if (cached?.length) return NextResponse.json({ source: "cache", foods: cached });
  if (!process.env.USDA_API_KEY) return NextResponse.json({ error: "Chưa cấu hình USDA_API_KEY." }, { status: 503 });
  const url = new URL("https://api.nal.usda.gov/fdc/v1/foods/search"); url.searchParams.set("api_key", process.env.USDA_API_KEY); url.searchParams.set("query", query); url.searchParams.set("pageSize", "8");
  const response = await fetch(url, { cache: "no-store" }); if (!response.ok) return NextResponse.json({ error: "USDA không phản hồi." }, { status: 502 });
  const result = await response.json();
  const foods = (result.foods ?? []).map((food: { fdcId: number; description: string; foodNutrients?: Array<{ nutrientName?: string; value?: number }> }) => ({ id: `usda-${food.fdcId}`, name: food.description, kcal_per100: value(food.foodNutrients, "energy"), protein_per100: value(food.foodNutrients, "protein"), carbs_per100: value(food.foodNutrients, "carbohydrate"), fat_per100: value(food.foodNutrients, "total lipid"), allergens: [], usda_fdc_id: String(food.fdcId), source: "usda" }));
  return NextResponse.json({ source: "usda", foods });
}
