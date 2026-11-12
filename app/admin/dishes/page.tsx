import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  getFallbackDishes,
  getFallbackIngredients,
  isSupabaseConfigured,
} from "@/lib/orders-db";
import { DishForm } from "@/components/dish-form";
import { AdminNav } from "@/components/admin-nav";
import { approveDish, createDish } from "./actions";

export const dynamic = "force-dynamic";

export default async function DishesPage() {
  const configured = isSupabaseConfigured();
  let ingredients = getFallbackIngredients().map((i) => ({
    id: i.id,
    name: i.name,
    kcal_per100: i.kcal_per100,
    protein_per100: i.protein_per100,
    carbs_per100: i.carbs_per100,
    fat_per100: i.fat_per100,
  }));
  let dishes = getFallbackDishes().map((d) => ({
    id: d.id,
    name: d.name,
    price_vnd: d.price_vnd,
    yield_g: d.yield_g,
    approved: d.approved,
  }));

  if (configured) {
    try {
      const db = createServerSupabaseClient();
      const [{ data: ingData }, { data: dishData }] = await Promise.all([
        db
          .from("ingredients")
          .select("id,name,kcal_per100,protein_per100,carbs_per100,fat_per100")
          .order("name"),
        db
          .from("dishes")
          .select("id,name,price_vnd,yield_g,approved")
          .order("created_at", { ascending: false }),
      ]);
      if (ingData) ingredients = ingData as typeof ingredients;
      if (dishData) dishes = dishData as typeof dishes;
    } catch (err) {
      console.warn("Supabase dishes load failed:", err);
    }
  }

  return (
    <main className="mx-auto max-w-4xl p-5">
      <AdminNav active="dishes" />
      <div className="mx-auto max-w-lg">
        <h1 className="text-2xl font-black text-brand-950">Món ăn</h1>
        <p className="mt-1 text-sm text-slate-600">
          Món mới luôn chờ duyệt; chỉ món đã duyệt mới được đưa vào thực đơn.
        </p>
        {!configured && (
          <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
            Đang hiển thị danh sách món demo cục bộ (chưa cấu hình Supabase). Tạo <code>.env.local</code> để lưu món ăn mới vào database.
          </p>
        )}
        <div className="mt-5">
          <DishForm ingredients={ingredients as never[]} action={createDish} />
        </div>
        <section className="mt-6 space-y-2">
          <h2 className="font-bold text-brand-950">Danh sách món ({dishes.length})</h2>
          {dishes.map((dish) => (
            <article
              className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-white p-3 shadow-sm"
              key={dish.id}
            >
              <div>
                <b>{dish.name}</b>
                <p className="text-xs text-slate-600">
                  {dish.price_vnd.toLocaleString("vi-VN")}đ · yield {dish.yield_g}g
                </p>
              </div>
              {dish.approved ? (
                <span className="text-sm font-bold text-brand-700">Đã duyệt</span>
              ) : (
                <form action={approveDish}>
                  <input type="hidden" name="id" value={dish.id} />
                  <button className="rounded-lg bg-orange-500 px-3 py-2 text-sm font-bold text-white">
                    Duyệt
                  </button>
                </form>
              )}
            </article>
          ))}
          {!dishes.length && (
            <p className="rounded-xl bg-white p-4 text-center text-sm text-slate-600 shadow-sm">
              Chưa có món nào trong danh sách.
            </p>
          )}
        </section>
      </div>
    </main>
  );
}
