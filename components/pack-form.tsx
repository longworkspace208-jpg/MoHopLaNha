"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { CookingBatch, OrderRecord } from "@/lib/types";
import { formatVnd } from "@/lib/format";
import { OrderStatusBadge } from "@/components/order-status-badge";

interface PackFormProps {
  order: OrderRecord;
  batches?: CookingBatch[];
}

type PortionRow = {
  actualGrams: string;
  cookedBatchId: string;
  cookedAt: string;
  lotCode: string;
  sourceNote: string;
};

function todayYmd(): string {
  return new Date().toISOString().slice(0, 10);
}

export function PackForm({ order, batches = [] }: PackFormProps) {
  const router = useRouter();
  const defaultDate = todayYmd();

  const [rows, setRows] = useState<PortionRow[]>(() =>
    order.items.map((item) => ({
      actualGrams: String(item.grams),
      cookedBatchId: "",
      cookedAt: defaultDate,
      lotCode: "",
      sourceNote: "",
    }))
  );

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const updateRow = (index: number, patch: Partial<PortionRow>) => {
    setRows((prev) =>
      prev.map((row, idx) => (idx === index ? { ...row, ...patch } : row))
    );
  };

  const applyBatch = (index: number, batchId: string) => {
    if (!batchId) {
      updateRow(index, { cookedBatchId: "" });
      return;
    }
    const batch = batches.find((b) => b.id === batchId);
    if (!batch) {
      updateRow(index, { cookedBatchId: "" });
      return;
    }
    updateRow(index, {
      cookedBatchId: batch.id,
      lotCode: batch.lotCode,
      cookedAt: batch.cookedAt.slice(0, 10),
      sourceNote: batch.supplierNote ?? "",
    });
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");

    try {
      const portions = order.items.map((item, idx) => {
        const row = rows[idx];
        return {
          orderItemId:
            typeof item.id === "number" ? item.id : Number(item.id) || idx + 1,
          actualGrams: Number(row.actualGrams),
          cookedBatchId: row.cookedBatchId.trim() || undefined,
          cookedAt: row.cookedAt || defaultDate,
          lotCode: row.lotCode.trim() || undefined,
          sourceNote: row.sourceNote.trim() || undefined,
        };
      });

      const res = await fetch(`/api/admin/orders/${order.id}/pack`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ portions }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Không thể đóng gói đơn hàng.");
      } else {
        setSuccess(true);
        router.refresh();
      }
    } catch {
      setError("Lỗi kết nối máy chủ.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <section className="rounded-2xl bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-black text-brand-950">
                Đóng gói đơn #{order.public_code}
              </h1>
              <OrderStatusBadge status={order.status} />
            </div>
            <p className="mt-1 text-sm text-slate-600">
              Khách hàng: <strong className="text-slate-900">{order.customer_name}</strong> ·{" "}
              {order.phone} · Tổng:{" "}
              <strong className="text-brand-700">{formatVnd(order.total_vnd)}</strong>
            </p>
          </div>
          <Link
            href={`/admin/orders/${order.id}`}
            className="text-sm font-bold text-brand-700 hover:underline"
          >
            ← Chi tiết đơn
          </Link>
        </div>

        {order.status !== "cooking" && !success && (
          <div className="mt-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-800">
            Lưu ý: Đơn hàng cần ở trạng thái <strong>cooking</strong> mới có thể xác nhận đóng gói (trạng thái hiện tại: <strong>{order.status}</strong>).
          </div>
        )}
      </section>

      {success ? (
        <section className="rounded-2xl bg-emerald-50 p-6 text-emerald-900 shadow-sm">
          <p className="text-base font-bold">
            Đóng gói thành công! Đơn chuyển sang trạng thái packed.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link
              href={`/admin/orders/${order.id}/labels`}
              className="rounded-xl bg-brand-700 px-4 py-2 text-sm font-bold text-white hover:bg-brand-950"
            >
              In tem QR →
            </Link>
            <Link
              href={`/admin/orders/${order.id}`}
              className="rounded-xl bg-white px-4 py-2 text-sm font-bold text-brand-700 shadow-sm hover:bg-brand-50"
            >
              Xem chi tiết đơn
            </Link>
          </div>
        </section>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          {order.items.map((item, idx) => {
            const row = rows[idx];
            return (
              <section
                key={`${item.dishId}-${idx}`}
                className="rounded-2xl bg-white p-5 shadow-sm"
              >
                <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2 border-b border-slate-100 pb-3">
                  <h2 className="text-base font-bold text-brand-950">
                    {idx + 1}. {item.name}
                  </h2>
                  <span className="text-sm text-slate-600">
                    Khối lượng đặt:{" "}
                    <strong className="text-brand-700">{item.grams}g</strong>
                  </span>
                </div>

                <div className="mb-3">
                  <label className="block text-xs font-semibold text-slate-600">
                    Chọn mẻ nấu (tùy chọn)
                  </label>
                  <select
                    value={row.cookedBatchId}
                    onChange={(e) => applyBatch(idx, e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
                  >
                    <option value="">
                      {batches.length > 0
                        ? "-- Không chọn mẻ nấu (nhập lot/nguồn thủ công bên dưới) --"
                        : "-- Chưa có mẻ nấu nào (nhập lot/nguồn thủ công bên dưới) --"}
                    </option>
                    {batches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.dishName} · Lot: {b.lotCode} ({b.cookedAt.slice(0, 10)})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700">
                      Khối lượng cân thực tế (g) *
                    </label>
                    <input
                      type="number"
                      min="1"
                      step="1"
                      required
                      value={row.actualGrams}
                      onChange={(e) => updateRow(idx, { actualGrams: e.target.value })}
                      className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700">
                      Ngày chế biến *
                    </label>
                    <input
                      type="date"
                      required
                      value={row.cookedAt}
                      onChange={(e) => updateRow(idx, { cookedAt: e.target.value })}
                      className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700">
                      Mã lô (lotCode — tùy chọn)
                    </label>
                    <input
                      type="text"
                      placeholder="VD: LOT-20261112-01"
                      value={row.lotCode}
                      onChange={(e) => updateRow(idx, { lotCode: e.target.value })}
                      className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700">
                      Ghi chú nguồn gốc (sourceNote — tùy chọn)
                    </label>
                    <input
                      type="text"
                      placeholder="VD: Gà ta Bình Định, rau VietGAP Đà Lạt"
                      value={row.sourceNote}
                      onChange={(e) => updateRow(idx, { sourceNote: e.target.value })}
                      className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                    />
                  </div>
                </div>
              </section>
            );
          })}

          {error && (
            <p className="rounded-xl bg-rose-50 p-3 text-sm font-medium text-rose-700">
              {error}
            </p>
          )}

          <div className="flex items-center justify-end gap-3">
            <Link
              href={`/admin/orders/${order.id}`}
              className="rounded-xl bg-white px-4 py-2.5 text-sm font-bold text-slate-700 shadow-sm hover:bg-slate-50"
            >
              Hủy
            </Link>
            <button
              type="submit"
              disabled={submitting || order.items.length === 0}
              className="rounded-xl bg-brand-700 px-5 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-brand-950 disabled:opacity-50"
            >
              {submitting ? "Đang lưu khẩu phần…" : "Xác nhận khẩu phần"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
