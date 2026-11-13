import "server-only";
import { unstable_cache } from "next/cache";
import { createServerSupabaseClient } from "./supabase/server";
import { calcDish } from "./nutrition";
import type { TodayMenu, MenuDish, Combo, Goal } from "./customer-menu";
import {
  isSupabaseConfigured,
  getFallbackDishes,
  getFallbackTodayOrderedCounts,
} from "./orders-db";

export function todayInVietnam() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const part = (type: "year" | "month" | "day") =>
    parts.find((v) => v.type === type)?.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export function getFallbackTodayMenu(menuDate: string) {
  const orderedCounts = getFallbackTodayOrderedCounts();
  const dishes = getFallbackDishes().map((dish) => ({
    ...dish,
    remaining_portions: Math.max(
      0,
      dish.portion_limit - (orderedCounts.get(dish.id) ?? 0)
    ),
  }));
  const d1 = dishes.find((d) => d.id === "ga-nuong-com-gao-lut") || dishes[0];
  const d2 = dishes.find((d) => d.id === "ca-hoi-sot-chanh") || dishes[1];
  const d3 = dishes.find((d) => d.id === "dau-hu-nam-hat") || dishes[2];

  const combos = [
    {
      goal: "balanced" as const,
      items: [
        { dish: d1, grams: 250 },
        { dish: d3, grams: 150 },
      ],
    },
    {
      goal: "light" as const,
      items: [
        { dish: d3, grams: 200 },
        { dish: d1, grams: 150 },
      ],
    },
    {
      goal: "protein" as const,
      items: [
        { dish: d1, grams: 300 },
        { dish: d2, grams: 200 },
      ],
    },
  ];

  return {
    menu_date: menuDate,
    dishes,
    combos,
  };
}

async function queryTodayMenuFromDb(menuDate: string) {
  console.info(
    `[DB Query] Đang truy vấn thực đơn và dữ liệu combo từ database cho ngày ${menuDate}...`
  );

  if (!isSupabaseConfigured()) {
    return getFallbackTodayMenu(menuDate);
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
      return getFallbackTodayMenu(menuDate);
    }

    const [
      { data: saleDishes, error: saleError },
      { data: combos, error: comboError },
    ] = await Promise.all([
      db
        .from("menu_dishes")
        .select("dish_id,portion_limit,step_g,min_g,max_g")
        .eq("menu_day_id", day.id),
      db.from("combos").select("id,goal").eq("menu_day_id", day.id),
    ]);

    if (saleError || comboError) {
      return getFallbackTodayMenu(menuDate);
    }

    const dishIds = saleDishes?.map((item) => item.dish_id) ?? [];
    const comboIds = combos?.map((combo) => combo.id) ?? [];

    const [{ data: dishes }, { data: items }, { data: recipeItems }] =
      await Promise.all([
        dishIds.length
          ? db
              .from("dishes")
              .select("id,name,price_vnd,image_url,yield_g")
              .in("id", dishIds)
          : Promise.resolve({ data: [] }),
        comboIds.length
          ? db
              .from("combo_items")
              .select("combo_id,dish_id,grams")
              .in("combo_id", comboIds)
          : Promise.resolve({ data: [] }),
        dishIds.length
          ? db
              .from("dish_ingredients")
              .select(
                "dish_id,raw_g,ingredients(kcal_per100,protein_per100,carbs_per100,fat_per100)"
              )
              .in("dish_id", dishIds)
          : Promise.resolve({ data: [] }),
      ]);

    const dishById = new Map(
      (dishes ?? []).map((dish) => {
        const recipe = (recipeItems ?? [])
          .filter((item) => item.dish_id === dish.id)
          .map((item) => ({
            raw_g: Number(item.raw_g),
            per100: {
              kcal: Number(
                (item.ingredients as unknown as { kcal_per100: number })
                  ?.kcal_per100 ?? 0
              ),
              protein: Number(
                (item.ingredients as unknown as { protein_per100: number })
                  ?.protein_per100 ?? 0
              ),
              carbs: Number(
                (item.ingredients as unknown as { carbs_per100: number })
                  ?.carbs_per100 ?? 0
              ),
              fat: Number(
                (item.ingredients as unknown as { fat_per100: number })
                  ?.fat_per100 ?? 0
              ),
            },
          }));
        return [
          dish.id,
          {
            ...dish,
            nutrition_per100: calcDish(recipe, Number(dish.yield_g)),
          },
        ];
      })
    );

    const dishesWithLimits: MenuDish[] = (saleDishes ?? []).map((sale) => {
      const base = dishById.get(sale.dish_id);
      const limit = Number(sale.portion_limit);
      return {
        id: sale.dish_id,
        name: base?.name ?? "",
        price_vnd: Number(base?.price_vnd ?? 0),
        image_url: base?.image_url ?? null,
        yield_g: Number(base?.yield_g ?? 350),
        portion_limit: limit,
        remaining_portions: limit,
        step_g: Number(sale.step_g),
        min_g: Number(sale.min_g),
        max_g: Number(sale.max_g),
        nutrition_per100: base?.nutrition_per100 ?? {
          kcal: 0,
          protein: 0,
          carbs: 0,
          fat: 0,
        },
      };
    });

    const fullDishById = new Map<string, MenuDish>(
      dishesWithLimits.map((d) => [d.id, d])
    );

    const output: Combo[] = (combos ?? []).map((combo) => ({
      goal: combo.goal as Exclude<Goal, "custom">,
      items: (items ?? [])
        .filter((item) => item.combo_id === combo.id)
        .map((item) => {
          const dish =
            fullDishById.get(item.dish_id) ??
            ({
              id: item.dish_id,
              name: "",
              price_vnd: 0,
              image_url: null,
              yield_g: 350,
              portion_limit: 50,
              step_g: 50,
              min_g: 100,
              max_g: 500,
              nutrition_per100: { kcal: 0, protein: 0, carbs: 0, fat: 0 },
            } as MenuDish);
          return {
            dish,
            grams: Number(item.grams),
          };
        }),
    }));

    return {
      menu_date: day.menu_date,
      dishes: dishesWithLimits,
      combos: output,
    } as TodayMenu;
  } catch (err) {
    console.warn("[MenuCache] Lỗi khi truy vấn DB, sử dụng dữ liệu dự phòng:", err);
    return getFallbackTodayMenu(menuDate);
  }
}

/**
 * Đọc thực đơn và dữ liệu combo qua unstable_cache có tag 'menu'.
 * Không truy vấn DB mỗi lượt xem thực đơn.
 */
export const getCachedTodayMenu = unstable_cache(
  async (menuDate: string) => {
    return queryTodayMenuFromDb(menuDate);
  },
  ["today-menu-cache"],
  {
    tags: ["menu"],
    revalidate: 86400, // Cache 24 giờ, revalidate khi có tag 'menu'
  }
);
