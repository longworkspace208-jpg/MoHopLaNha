import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { calcDish } from "@/lib/nutrition";
import {
  isSupabaseConfigured,
  getFallbackDishes,
  getFallbackTodayOrderedCounts,
} from "@/lib/orders-db";

export const dynamic = "force-dynamic";

const todayInVietnam = () => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(new Date());
  const part = (type: "year" | "month" | "day") => parts.find((v) => v.type === type)?.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
};

function getFallbackTodayMenu(menuDate: string) {
  const orderedCounts = getFallbackTodayOrderedCounts();
  const dishes = getFallbackDishes().map((dish) => ({
    ...dish,
    remaining_portions: Math.max(0, dish.portion_limit - (orderedCounts.get(dish.id) ?? 0)),
  }));
  const d1 = dishes.find((d) => d.id === "ga-nuong-com-gao-lut") || dishes[0];
  const d2 = dishes.find((d) => d.id === "ca-hoi-sot-chanh") || dishes[1];
  const d3 = dishes.find((d) => d.id === "dau-hu-nam-hat") || dishes[2];

  const combos = [
    {
      goal: "balanced" as const,
      items: [
        { dish: d1, grams: 250 },
        { dish: d3, grams: 150 }
      ]
    },
    {
      goal: "light" as const,
      items: [
        { dish: d3, grams: 200 },
        { dish: d1, grams: 150 }
      ]
    },
    {
      goal: "protein" as const,
      items: [
        { dish: d1, grams: 300 },
        { dish: d2, grams: 200 }
      ]
    }
  ];

  return {
    menu_date: menuDate,
    dishes,
    combos
  };
}

export async function GET() {
  const menuDate = todayInVietnam();

  if (!isSupabaseConfigured()) {
    return NextResponse.json(getFallbackTodayMenu(menuDate), {
      headers: { "Cache-Control": "no-store" }
    });
  }

  try {
    const db = createServerSupabaseClient();
    const { data: day, error: dayError } = await db
      .from("menu_days")
      .select("id,menu_date")
      .eq("menu_date", menuDate)
      .eq("published", true)
      .maybeSingle();

    if (dayError || !day) {
      // Fallback nếu ngày hôm nay chưa được admin publish trên Supabase
      return NextResponse.json(getFallbackTodayMenu(menuDate), {
        headers: { "Cache-Control": "no-store" }
      });
    }

    const [{ data: saleDishes, error: saleError }, { data: combos, error: comboError }] =
      await Promise.all([
        db
          .from("menu_dishes")
          .select("dish_id,portion_limit,step_g,min_g,max_g")
          .eq("menu_day_id", day.id),
        db.from("combos").select("id,goal").eq("menu_day_id", day.id)
      ]);

    if (saleError || comboError) {
      return NextResponse.json(getFallbackTodayMenu(menuDate), {
        headers: { "Cache-Control": "no-store" }
      });
    }

    const dishIds = saleDishes?.map((item) => item.dish_id) ?? [];
    const comboIds = combos?.map((combo) => combo.id) ?? [];

    const [{ data: dishes }, { data: items }, { data: recipeItems }, { data: todayOrders }] =
      await Promise.all([
        dishIds.length
          ? db.from("dishes").select("id,name,price_vnd,image_url,yield_g").in("id", dishIds)
          : Promise.resolve({ data: [] }),
        comboIds.length
          ? db.from("combo_items").select("combo_id,dish_id,grams").in("combo_id", comboIds)
          : Promise.resolve({ data: [] }),
        dishIds.length
          ? db
              .from("dish_ingredients")
              .select("dish_id,raw_g,ingredients(kcal_per100,protein_per100,carbs_per100,fat_per100)")
              .in("dish_id", dishIds)
          : Promise.resolve({ data: [] }),
        db
          .from("orders")
          .select("id")
          .gte("created_at", `${menuDate}T00:00:00+07:00`)
          .neq("status", "cancelled")
      ]);

    const usedCounts = new Map<string, number>();
    const todayOrderIds = (todayOrders ?? []).map((o) => o.id);
    if (todayOrderIds.length && dishIds.length) {
      const { data: todayOrderItems } = await db
        .from("order_items")
        .select("dish_id")
        .in("order_id", todayOrderIds)
        .in("dish_id", dishIds);
      for (const row of todayOrderItems ?? []) {
        usedCounts.set(row.dish_id, (usedCounts.get(row.dish_id) ?? 0) + 1);
      }
    }

    const dishById = new Map(
      (dishes ?? []).map((dish) => {
        const recipe = (recipeItems ?? [])
          .filter((item) => item.dish_id === dish.id)
          .map((item) => ({
            raw_g: Number(item.raw_g),
            per100: {
              kcal: Number((item.ingredients as unknown as { kcal_per100: number }).kcal_per100),
              protein: Number((item.ingredients as unknown as { protein_per100: number }).protein_per100),
              carbs: Number((item.ingredients as unknown as { carbs_per100: number }).carbs_per100),
              fat: Number((item.ingredients as unknown as { fat_per100: number }).fat_per100)
            }
          }));
        return [dish.id, { ...dish, nutrition_per100: calcDish(recipe, Number(dish.yield_g)) }];
      })
    );

    const dishesWithLimits = (saleDishes ?? []).map((sale) => {
      const base = dishById.get(sale.dish_id);
      const limit = Number(sale.portion_limit);
      const remaining = Math.max(0, limit - (usedCounts.get(sale.dish_id) ?? 0));
      return {
        ...base,
        portion_limit: limit,
        remaining_portions: remaining,
        step_g: Number(sale.step_g),
        min_g: Number(sale.min_g),
        max_g: Number(sale.max_g)
      };
    });

    const fullDishById = new Map(dishesWithLimits.map((d) => [d.id, d]));

    const output = (combos ?? []).map((combo) => ({
      goal: combo.goal,
      items: (items ?? [])
        .filter((item) => item.combo_id === combo.id)
        .map((item) => ({
          dish: fullDishById.get(item.dish_id) ?? dishById.get(item.dish_id),
          grams: Number(item.grams)
        }))
    }));

    return NextResponse.json(
      { menu_date: day.menu_date, dishes: dishesWithLimits, combos: output },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch {
    return NextResponse.json(getFallbackTodayMenu(menuDate), {
      headers: { "Cache-Control": "no-store" }
    });
  }
}
