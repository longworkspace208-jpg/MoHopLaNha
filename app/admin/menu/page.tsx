import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/admin-auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getFallbackDishes, isSupabaseConfigured } from "@/lib/orders-db";
import { MenuBuilder } from "@/components/menu-builder";
import { AdminNav } from "@/components/admin-nav";
import { publishDailyMenu, saveDailyMenu } from "./actions";

export const dynamic = "force-dynamic";

export default async function MenuPage() {
  if (!(await isAdmin())) {
    redirect("/admin/login");
  }

  const configured = isSupabaseConfigured();
  let dishes = getFallbackDishes()
    .filter((d) => d.approved)
    .map((d) => ({ id: d.id, name: d.name, price_vnd: d.price_vnd }));

  if (configured) {
    try {
      const { data } = await createServerSupabaseClient()
        .from("dishes")
        .select("id,name,price_vnd")
        .eq("approved", true)
        .order("name");
      if (data) dishes = data as typeof dishes;
    } catch (err) {
      console.warn("Supabase admin menu load failed:", err);
    }
  }

  return (
    <main className="mx-auto max-w-4xl p-5">
      <AdminNav active="menu" />
      <div className="mx-auto max-w-lg">
        <h1 className="text-2xl font-black text-brand-950">Thực đơn theo ngày</h1>
        <p className="mt-1 text-sm text-slate-600">
          Chọn món đã duyệt, số suất và định lượng gợi ý cho ba mục tiêu.
        </p>
        {!configured && (
          <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
            Đang dùng thực đơn demo mặc định (chưa cấu hình Supabase). Tạo <code>.env.local</code> để lưu và công bố thực đơn theo ngày trên Postgres.
          </p>
        )}
        <div className="mt-5">
          {dishes.length === 0 ? (
            <div className="rounded-2xl bg-white p-6 text-center text-sm text-slate-600 shadow-sm">
              Chưa có món ăn nào được duyệt để đưa vào thực đơn. Hãy duyệt món ở mục <strong>Món ăn</strong> trước.
            </div>
          ) : (
            <MenuBuilder
              dishes={dishes as never[]}
              saveAction={saveDailyMenu}
              publishAction={publishDailyMenu}
            />
          )}
        </div>
      </div>
    </main>
  );
}
