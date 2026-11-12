import {
  getAllCookingBatches,
  getFallbackDishes,
  isSupabaseConfigured,
} from "@/lib/orders-db";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { CookingBatch } from "@/lib/types";
import { AdminNav } from "@/components/admin-nav";
import { CookingBatchForm } from "@/components/cooking-batch-form";

export const dynamic = "force-dynamic";

async function loadBatches(): Promise<CookingBatch[]> {
  if (isSupabaseConfigured()) {
    try {
      const supabase = createServerSupabaseClient();
      const { data, error } = await supabase
        .from("cooking_batches")
        .select("*")
        .order("cooked_at", { ascending: false });
      if (!error && data) {
        return data.map((row) => ({
          id: row.id,
          dishId: row.dish_id,
          dishName: row.dish_name,
          lotCode: row.lot_code,
          supplierNote: row.supplier_note ?? null,
          cookedYieldG: Number(row.cooked_yield_g),
          cookedAt: row.cooked_at,
        }));
      }
    } catch (err) {
      console.warn("Supabase cooking batches load failed:", err);
    }
  }
  return getAllCookingBatches();
}

async function loadDishOptions(): Promise<Array<{ id: string; name: string }>> {
  if (isSupabaseConfigured()) {
    try {
      const supabase = createServerSupabaseClient();
      const { data, error } = await supabase
        .from("dishes")
        .select("id, name")
        .order("name");
      if (!error && data && data.length > 0) {
        return data.map((d) => ({ id: d.id, name: d.name }));
      }
    } catch {
      // fallback
    }
  }
  return getFallbackDishes().map((d) => ({ id: d.id, name: d.name }));
}

export default async function AdminCookingPage() {
  const [batches, dishes] = await Promise.all([
    loadBatches(),
    loadDishOptions(),
  ]);

  return (
    <main className="mx-auto max-w-4xl p-5">
      <AdminNav active="cooking" />
      <h1 className="text-2xl font-black text-brand-950">Quản lý mẻ chế biến</h1>
      <p className="mt-1 text-sm text-slate-600">
        Ghi nhận lô nấu, sản lượng thực tế và thông tin nguồn gốc nguyên liệu.
      </p>

      <div className="mt-5">
        <CookingBatchForm dishes={dishes} />
      </div>

      <section className="mt-8 space-y-3">
        <h2 className="text-lg font-bold text-brand-950">
          Danh sách mẻ nấu ({batches.length})
        </h2>

        {batches.map((batch) => (
          <article
            key={batch.id}
            className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100"
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h3 className="font-bold text-brand-950">{batch.dishName}</h3>
                <p className="mt-0.5 text-xs text-slate-500">
                  dishId: <span className="font-mono">{batch.dishId}</span> · ID:{" "}
                  <span className="font-mono">{batch.id}</span>
                </p>
              </div>
              <span className="rounded-full bg-brand-50 px-3 py-1 font-mono text-xs font-bold text-brand-700">
                {batch.lotCode}
              </span>
            </div>

            <div className="mt-2 flex flex-wrap gap-4 text-sm text-slate-700">
              <span>
                Sản lượng: <strong>{batch.cookedYieldG}g</strong>
              </span>
              <span>
                Ngày nấu:{" "}
                <strong>{batch.cookedAt.slice(0, 10)}</strong>
              </span>
              {batch.supplierNote && (
                <span className="text-slate-600">
                  Nguồn: {batch.supplierNote}
                </span>
              )}
            </div>
          </article>
        ))}

        {batches.length === 0 && (
          <div className="rounded-2xl bg-white p-6 text-center text-sm text-slate-500 shadow-sm">
            Chưa có mẻ nấu nào được ghi nhận.
          </div>
        )}
      </section>
    </main>
  );
}
