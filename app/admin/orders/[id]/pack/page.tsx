import { notFound, redirect } from "next/navigation";
import { isAdmin } from "@/lib/admin-auth";
import {
  getAllCookingBatches,
  getOrderById,
  isSupabaseConfigured,
} from "@/lib/orders-db";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { CookingBatch } from "@/lib/types";
import { AdminNav } from "@/components/admin-nav";
import { PackForm } from "@/components/pack-form";

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
      console.warn("Load batches supabase error:", err);
    }
  }
  return getAllCookingBatches();
}

export default async function AdminOrderPackPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  if (!(await isAdmin())) {
    redirect("/admin/login");
  }

  const { id } = await params;
  const [order, batches] = await Promise.all([
    getOrderById(id),
    loadBatches(),
  ]);

  if (!order) {
    notFound();
  }

  return (
    <main className="mx-auto max-w-4xl p-5">
      <AdminNav active="orders" />
      <PackForm order={order} batches={batches} />
    </main>
  );
}
