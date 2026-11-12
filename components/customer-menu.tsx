"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { TodayMenu } from "@/lib/customer-menu";
import { useCartStore } from "@/lib/cart-store";
import { MealCustomizer } from "./meal-customizer";

const label = {
  balanced: "Cân bằng",
  light: "Ít calories hơn",
  protein: "Nhiều protein"
};

export function CustomerMenu() {
  const [menu, setMenu] = useState<TodayMenu | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");

  const people = useCartStore((state) => state.people);
  const goal = useCartStore((state) => state.goal);
  const setGoal = useCartStore((state) => state.setGoal);
  const setLines = useCartStore((state) => state.setLines);
  const addDish = useCartStore((state) => state.addDish);

  const loadMenu = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/menu/today", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? "Hôm nay chưa có thực đơn được công bố.");
      }
      setMenu(data);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Không thể tải thực đơn hôm nay. Vui lòng thử lại."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMenu();
  }, [loadMenu]);

  if (loading) {
    return (
      <div className="rounded-card bg-white p-6 text-center text-sm text-slate-500 shadow-sm">
        Đang tìm thực đơn hôm nay…
      </div>
    );
  }

  if (error) {
    return (
      <div
        role="alert"
        className="rounded-card border border-rose-200 bg-rose-50 p-6 text-center shadow-sm"
      >
        <p className="text-base font-bold text-rose-900">Chưa tải được thực đơn</p>
        <p className="mt-1.5 text-sm text-rose-700">{error}</p>
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          <button
            type="button"
            onClick={loadMenu}
            className="rounded-full bg-orange-500 px-5 py-2.5 text-sm font-bold text-white hover:bg-orange-600"
          >
            Thử tải lại
          </button>
          <Link
            href="/"
            className="rounded-full bg-white px-5 py-2.5 text-sm font-bold text-brand-800 ring-1 ring-brand-200 hover:bg-brand-50"
          >
            Về trang chủ
          </Link>
        </div>
      </div>
    );
  }

  if (!menu || menu.dishes.length === 0) {
    return (
      <div className="rounded-card bg-white p-8 text-center shadow-sm">
        <div className="text-4xl">📋</div>
        <h1 className="mt-3 text-xl font-black text-brand-950">
          Hôm nay chưa có món nào mở bán
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          Bếp chưa công bố thực đơn cho ngày hôm nay. Vui lòng quay lại sau nhé!
        </p>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <button
            type="button"
            onClick={loadMenu}
            className="rounded-full bg-orange-500 px-5 py-2.5 text-sm font-bold text-white hover:bg-orange-600"
          >
            Kiểm tra lại
          </button>
          <Link
            href="/"
            className="rounded-full bg-brand-50 px-5 py-2.5 text-sm font-bold text-brand-800 hover:bg-brand-100"
          >
            ← Chọn lại số người
          </Link>
        </div>
      </div>
    );
  }

  const chooseCombo = (combo: TodayMenu["combos"][number]) => {
    const soldOutItem = combo.items.find(
      (item) => (item.dish.remaining_portions ?? item.dish.portion_limit) <= 0
    );
    if (soldOutItem) {
      setActionError(
        `Combo này có món "${soldOutItem.dish.name}" đã hết suất hôm nay. Vui lòng chọn combo hoặc món lẻ khác.`
      );
      return;
    }
    setActionError("");
    setGoal(combo.goal);
    setLines(
      combo.items.map((item) => ({
        dish: item.dish,
        gramsPerPerson: item.grams
      }))
    );
  };

  const handleAddSingleDish = (dish: TodayMenu["dishes"][number]) => {
    const remaining = dish.remaining_portions ?? dish.portion_limit;
    if (remaining <= 0) {
      setActionError(
        `Món "${dish.name}" đã hết suất hôm nay. Vui lòng chọn món khác.`
      );
      return;
    }
    setActionError("");
    setGoal("custom");
    addDish(dish);
  };

  return (
    <div className="space-y-6">
      <section>
        <p className="text-sm font-semibold text-brand-700">
          Gợi ý cho {people === 5 ? "5+" : people} người
        </p>
        <h1 className="mt-1 text-2xl font-black text-brand-950">Thực đơn hôm nay</h1>
        <p className="mt-1 text-sm text-slate-600">
          Định lượng hiển thị theo một người, tổng bữa ăn tự nhân theo số người.
        </p>
      </section>

      {actionError && (
        <div
          role="alert"
          className="rounded-2xl border border-rose-200 bg-rose-50 p-3.5 text-sm font-medium text-rose-800"
        >
          ⚠️ {actionError}
        </div>
      )}

      <section className="space-y-3">
        <h2 className="text-lg font-black text-brand-950">3 combo gợi ý</h2>
        {menu.combos.length === 0 ? (
          <p className="rounded-2xl bg-white p-4 text-sm text-slate-500 shadow-sm">
            Chưa có combo gợi ý cho hôm nay. Bạn có thể tự ghép món lẻ bên dưới.
          </p>
        ) : (
          menu.combos.map((combo) => {
            const hasSoldOut = combo.items.some(
              (item) => (item.dish.remaining_portions ?? item.dish.portion_limit) <= 0
            );
            return (
              <button
                key={combo.goal}
                type="button"
                onClick={() => chooseCombo(combo)}
                className={`w-full rounded-card border p-4 text-left transition ${
                  hasSoldOut
                    ? "border-slate-200 bg-slate-50 opacity-75"
                    : goal === combo.goal
                      ? "border-brand-600 bg-brand-50"
                      : "border-transparent bg-white shadow-sm hover:border-brand-200"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <b className="text-brand-950">{label[combo.goal]}</b>
                  {hasSoldOut ? (
                    <span className="rounded-full bg-rose-100 px-2.5 py-0.5 text-xs font-bold text-rose-700">
                      Có món hết suất
                    </span>
                  ) : (
                    <span className="text-sm font-bold text-brand-700">Chọn</span>
                  )}
                </div>
                <p className="mt-2 text-sm text-slate-600">
                  {combo.items
                    .map((item) => `${item.dish.name} ${item.grams * people}g`)
                    .join(" · ")}
                </p>
              </button>
            );
          })
        )}
      </section>

      <section>
        <h2 className="text-lg font-black text-brand-950">Tự ghép món lẻ</h2>
        <div className="mt-3 space-y-2.5">
          {menu.dishes.map((dish) => {
            const remaining = dish.remaining_portions ?? dish.portion_limit;
            const isSoldOut = remaining <= 0;
            return (
              <article
                key={dish.id}
                className={`flex items-center justify-between gap-3 rounded-xl p-3.5 shadow-sm ${
                  isSoldOut ? "bg-slate-50 opacity-80 ring-1 ring-slate-200" : "bg-white"
                }`}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <b className="text-brand-950">{dish.name}</b>
                    {isSoldOut ? (
                      <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[11px] font-bold text-rose-700">
                        Hết suất hôm nay
                      </span>
                    ) : remaining <= 5 ? (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-800">
                        Còn {remaining} suất
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-0.5 text-xs text-slate-500">
                    Từ {dish.min_g * people}g ·{" "}
                    {dish.price_vnd.toLocaleString("vi-VN")}đ/hộp chuẩn
                  </p>
                </div>
                <button
                  type="button"
                  disabled={isSoldOut}
                  onClick={() => handleAddSingleDish(dish)}
                  className={`shrink-0 rounded-full px-3.5 py-2 text-xs font-bold transition sm:text-sm ${
                    isSoldOut
                      ? "cursor-not-allowed bg-slate-200 text-slate-500"
                      : "border border-brand-700 text-brand-700 hover:bg-brand-50"
                  }`}
                >
                  {isSoldOut ? "Hết suất" : "Thêm"}
                </button>
              </article>
            );
          })}
        </div>
      </section>

      <MealCustomizer />
    </div>
  );
}
