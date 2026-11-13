import { NextResponse } from "next/server";
import {
  requireAdmin,
  AdminUnauthorizedError,
  extractSessionToken,
} from "@/lib/admin-auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { usdaSearchQuerySchema, formatZodError } from "@/lib/validations";
import { getClientIp, limit, rateLimitResponse } from "@/lib/ratelimit";

const value = (
  nutrients: Array<{ nutrientName?: string; value?: number }> | undefined,
  name: string
) =>
  nutrients?.find((n) => n.nutrientName?.toLowerCase().includes(name))?.value ?? 0;

export async function GET(request: Request) {
  try {
    await requireAdmin(request);
  } catch (err) {
    if (err instanceof AdminUnauthorizedError) {
      return NextResponse.json({ error: "Yêu cầu quyền quản trị viên." }, { status: 401 });
    }
    return NextResponse.json({ error: "Lỗi xác thực." }, { status: 401 });
  }

  // Giới hạn tần suất: 30 lần / phút theo phiên admin
  const sessionToken = extractSessionToken(request) || getClientIp(request);

  const rateCheck = await limit("usda_search", sessionToken);
  if (!rateCheck.ok) {
    return rateLimitResponse(
      rateCheck.retryAfter,
      `Bạn đã tìm kiếm USDA quá nhanh (tối đa 30 lần/phút). Vui lòng thử lại sau ${rateCheck.retryAfter} giây.`
    );
  }

  const rawQuery = new URL(request.url).searchParams.get("q");
  const validation = usdaSearchQuerySchema.safeParse({ q: rawQuery ?? "" });
  if (!validation.success) {
    return NextResponse.json(
      { error: formatZodError(validation.error) },
      { status: 400 }
    );
  }

  const query = validation.data.q;
  const db = createServerSupabaseClient();
  const { data: cached } = await db
    .from("ingredients")
    .select("id,name,kcal_per100,protein_per100,carbs_per100,fat_per100,allergens,usda_fdc_id,source")
    .ilike("name", query)
    .limit(10);

  if (cached?.length) {
    return NextResponse.json({ source: "cache", foods: cached });
  }

  if (!process.env.USDA_API_KEY) {
    return NextResponse.json(
      { error: "Chưa cấu hình USDA_API_KEY." },
      { status: 503 }
    );
  }

  try {
    const url = new URL("https://api.nal.usda.gov/fdc/v1/foods/search");
    url.searchParams.set("api_key", process.env.USDA_API_KEY);
    url.searchParams.set("query", query);
    url.searchParams.set("pageSize", "8");

    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) {
      return NextResponse.json(
        { error: "Dịch vụ USDA không phản hồi." },
        { status: 502 }
      );
    }

    const result = await response.json();
    const foods = (result.foods ?? []).map(
      (food: {
        fdcId: number;
        description: string;
        foodNutrients?: Array<{ nutrientName?: string; value?: number }>;
      }) => ({
        id: `usda-${food.fdcId}`,
        name: food.description,
        kcal_per100: value(food.foodNutrients, "energy"),
        protein_per100: value(food.foodNutrients, "protein"),
        carbs_per100: value(food.foodNutrients, "carbohydrate"),
        fat_per100: value(food.foodNutrients, "total lipid"),
        allergens: [],
        usda_fdc_id: String(food.fdcId),
        source: "usda",
      })
    );

    return NextResponse.json({ source: "usda", foods });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Lỗi tra cứu USDA." },
      { status: 500 }
    );
  }
}
