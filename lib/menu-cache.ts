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

    // 1. Lấy tất cả món ăn đã duyệt từ database
    const { data: allApprovedDishes, error: approvedError } = await db
      .from("dishes")
      .select("id,name,price_vnd,image_url,yield_g,approved")
      .eq("approved", true)
      .order("created_at", { ascending: true });

    if (approvedError || !allApprovedDishes || allApprovedDishes.length === 0) {
      return getFallbackTodayMenu(menuDate);
    }

    // 2. Tìm ngày bán đã công bố hoặc tự động tạo nếu chưa có
    let { data: day } = await db
      .from("menu_days")
      .select("id,menu_date")
      .eq("menu_date", menuDate)
      .eq("published", true)
      .maybeSingle();

    if (!day) {
      const { data: newDay } = await db
        .from("menu_days")
        .insert({ menu_date: menuDate, published: true })
        .select("id,menu_date")
        .single();
      day = newDay;
    }

    const [
      { data: rawSaleDishes },
      { data: combos },
    ] = await Promise.all([
      day
        ? db
            .from("menu_dishes")
            .select("dish_id,portion_limit,step_g,min_g,max_g")
            .eq("menu_day_id", day.id)
        : Promise.resolve({ data: [] }),
      day
        ? db.from("combos").select("id,goal").eq("menu_day_id", day.id)
        : Promise.resolve({ data: [] }),
    ]);

    const saleDishes = rawSaleDishes ? [...rawSaleDishes] : [];
    const saleDishMap = new Map(saleDishes.map((s) => [s.dish_id, s]));

    // Đảm bảo mọi món đã duyệt đều xuất hiện trên thực đơn
    const missingDishes = allApprovedDishes.filter((d) => !saleDishMap.has(d.id));
    if (missingDishes.length > 0 && day) {
      const newSaleRows = missingDishes.map((d) => ({
        menu_day_id: day.id,
        dish_id: d.id,
        portion_limit: 50,
        step_g: 50,
        min_g: 100,
        max_g: 600,
      }));
      await db.from("menu_dishes").upsert(newSaleRows, {
        onConflict: "menu_day_id,dish_id",
        ignoreDuplicates: true,
      });
      for (const row of newSaleRows) {
        saleDishes.push(row);
        saleDishMap.set(row.dish_id, row);
      }
    }

    const allDishIds = allApprovedDishes.map((d) => d.id);
    const comboIds = combos?.map((combo) => combo.id) ?? [];

    const [{ data: items }, { data: recipeItems }] = await Promise.all([
      comboIds.length
        ? db
            .from("combo_items")
            .select("combo_id,dish_id,grams")
            .in("combo_id", comboIds)
        : Promise.resolve({ data: [] }),
      allDishIds.length
        ? db
            .from("dish_ingredients")
            .select(
              "dish_id,raw_g,ingredients(kcal_per100,protein_per100,carbs_per100,fat_per100)"
            )
            .in("dish_id", allDishIds)
        : Promise.resolve({ data: [] }),
    ]);

    // Tính số suất đã đặt hôm nay để cập nhật remaining_portions
    const startIso = `${menuDate}T00:00:00+07:00`;
    const { data: todayOrders } = await db
      .from("orders")
      .select("id")
      .gte("created_at", startIso)
      .neq("status", "cancelled");

    const orderIds = (todayOrders ?? []).map((o) => o.id);
    const usedCounts = new Map<string, number>();
    if (orderIds.length > 0) {
      const { data: todayItems } = await db
        .from("order_items")
        .select("dish_id")
        .in("order_id", orderIds);
      for (const row of todayItems ?? []) {
        usedCounts.set(row.dish_id, (usedCounts.get(row.dish_id) ?? 0) + 1);
      }
    }

    const dishById = new Map(
      allApprovedDishes.map((dish) => {
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
            nutrition_per100: calcDish(recipe, Number(dish.yield_g) || 350),
          },
        ];
      })
    );

    const dishesWithLimits: MenuDish[] = allApprovedDishes.map((dish) => {
      const sale = saleDishMap.get(dish.id);
      const limit = Number(sale?.portion_limit ?? 50);
      const orderedCount = usedCounts.get(dish.id) ?? 0;
      const base = dishById.get(dish.id);

      return {
        id: dish.id,
        name: dish.name,
        price_vnd: Number(dish.price_vnd ?? 0),
        image_url: dish.image_url ?? null,
        yield_g: Number(dish.yield_g ?? 350),
        portion_limit: limit,
        remaining_portions: Math.max(0, limit - orderedCount),
        step_g: Number(sale?.step_g ?? 50),
        min_g: Number(sale?.min_g ?? 100),
        max_g: Number(sale?.max_g ?? 600),
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

    let outputCombos: Combo[] = [];
    if (combos && combos.length > 0 && items && items.length > 0) {
      outputCombos = combos.map((combo) => ({
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
    } else {
      const d1 = dishesWithLimits[0];
      const d2 = dishesWithLimits[1] || d1;
      const d3 = dishesWithLimits[2] || d1;
      outputCombos = [
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
    }

    return {
      menu_date: menuDate,
      dishes: dishesWithLimits,
      combos: outputCombos,
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
