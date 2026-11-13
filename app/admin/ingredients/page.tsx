import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/admin-auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getFallbackIngredients, isSupabaseConfigured } from "@/lib/orders-db";
import { IngredientManager } from "@/components/ingredient-manager";
import { AdminNav } from "@/components/admin-nav";

export const dynamic = "force-dynamic";

export default async function IngredientsPage() {
  if (!(await isAdmin())) {
    redirect("/admin/login");
  }

  const configured = isSupabaseConfigured();
  let rows = getFallbackIngredients().map((ing) => ({
    ...ing,
    usda_fdc_id: null,
    source: "manual" as const,
  }));

  if (configured) {
    try {
      const { data } = await createServerSupabaseClient()
        .from("ingredients")
        .select(
          "id,name,kcal_per100,protein_per100,carbs_per100,fat_per100,allergens,usda_fdc_id,source"
        )
        .order("name");
      if (data) rows = data as typeof rows;
    } catch (err) {
      console.warn("Supabase ingredients load failed:", err);
    }
  }

  return (
    <main className="mx-auto max-w-4xl p-5">
      <AdminNav active="ingredients" />
      <div className="mx-auto max-w-lg">
        <h1 className="text-2xl font-black text-brand-950">Nguyên liệu</h1>
        <p className="mt-1 text-sm text-slate-600">
          Số liệu có thể chỉnh tay trước khi lưu.
        </p>
        {!configured && (
          <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
            Đang hiển thị dữ liệu demo cục bộ (chưa cấu hình Supabase). Tạo <code>.env.local</code> để lưu nguyên liệu vào Postgres.
          </p>
        )}
        <div className="mt-5">
          <IngredientManager initial={rows as never[]} />
        </div>
      </div>
    </main>
  );
}
