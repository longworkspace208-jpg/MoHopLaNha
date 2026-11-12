"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

interface DishOption {
  id: string;
  name: string;
}

interface CookingBatchFormProps {
  dishes?: DishOption[];
}

function todayYmd(): string {
  return new Date().toISOString().slice(0, 10);
}

export function CookingBatchForm({ dishes = [] }: CookingBatchFormProps) {
  const router = useRouter();
  const [dishName, setDishName] = useState("");
  const [dishId, setDishId] = useState("");
  const [lotCode, setLotCode] = useState("");
  const [supplierNote, setSupplierNote] = useState("");
  const [cookedYieldG, setCookedYieldG] = useState("");
  const [cookedAt, setCookedAt] = useState(todayYmd);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleDishPreset = (selectedId: string) => {
    const found = dishes.find((d) => d.id === selectedId);
    if (found) {
      setDishId(found.id);
      setDishName(found.name);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    setSuccess("");

    try {
      const yieldNum = Number(cookedYieldG);
      const res = await fetch("/api/admin/cooking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dishId: dishId.trim(),
          dishName: dishName.trim(),
          lotCode: lotCode.trim(),
          supplierNote: supplierNote.trim() || null,
          cookedYieldG: yieldNum,
          cookedAt,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Không thể tạo mẻ nấu.");
      } else {
        setSuccess(`✓ Đã tạo mẻ nấu ${data.batch?.lotCode ?? lotCode}`);
        setLotCode("");
        setCookedYieldG("");
        setSupplierNote("");
        router.refresh();
      }
    } catch {
      setError("Lỗi kết nối máy chủ.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-2xl bg-white p-5 shadow-sm space-y-4"
    >
      <h2 className="text-lg font-bold text-brand-950">Tạo mẻ chế biến mới</h2>

      {dishes.length > 0 && (
        <div>
          <label className="block text-xs font-semibold text-slate-600">
            Chọn nhanh món ăn (tự điền dishId & tên món)
          </label>
          <select
            defaultValue=""
            onChange={(e) => handleDishPreset(e.target.value)}
            className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
          >
            <option value="">-- Chọn món hoặc nhập thủ công bên dưới --</option>
            {dishes.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name} ({d.id})
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="block text-xs font-semibold text-slate-700">
            Tên món (dishName) *
          </label>
          <input
            type="text"
            required
            placeholder="VD: Gà nướng cơm gạo lứt"
            value={dishName}
            onChange={(e) => setDishName(e.target.value)}
            className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700">
            Mã món (dishId) *
          </label>
          <input
            type="text"
            required
            placeholder="UUID hoặc ga-nuong-com-gao-lut"
            value={dishId}
            onChange={(e) => setDishId(e.target.value)}
            className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700">
            Mã lô (lotCode) *
          </label>
          <input
            type="text"
            required
            placeholder="VD: LOT-GA-20261112"
            value={lotCode}
            onChange={(e) => setLotCode(e.target.value)}
            className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700">
            Sản lượng sau nấu (cookedYieldG, gram) *
          </label>
          <input
            type="number"
            required
            min="1"
            step="1"
            placeholder="VD: 3500"
            value={cookedYieldG}
            onChange={(e) => setCookedYieldG(e.target.value)}
            className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700">
            Ngày chế biến (cookedAt) *
          </label>
          <input
            type="date"
            required
            value={cookedAt}
            onChange={(e) => setCookedAt(e.target.value)}
            className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700">
            Nguồn gốc / Ghi chú NCC (supplierNote)
          </label>
          <input
            type="text"
            placeholder="VD: Ức gà CP tươi, giao 6h sáng"
            value={supplierNote}
            onChange={(e) => setSupplierNote(e.target.value)}
            className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
          />
        </div>
      </div>

      {error && (
        <p className="rounded-xl bg-rose-50 p-3 text-sm font-medium text-rose-700">
          {error}
        </p>
      )}
      {success && (
        <p className="rounded-xl bg-emerald-50 p-3 text-sm font-medium text-emerald-700">
          {success}
        </p>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="rounded-xl bg-brand-700 px-4 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-brand-950 disabled:opacity-50"
      >
        {submitting ? "Đang lưu…" : "Lưu mẻ nấu"}
      </button>
    </form>
  );
}
