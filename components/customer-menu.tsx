"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import type { TodayMenu } from "@/lib/customer-menu";
import { useCartStore } from "@/lib/cart-store";
import { formatVnd } from "@/lib/format";
import { MealCustomizer } from "./meal-customizer";

const label = {
  balanced: "Cân bằng",
  light: "Ít calories hơn",
  protein: "Nhiều protein",
};

export function CustomerMenu({
  initialMenu,
}: {
  initialMenu?: TodayMenu | null;
}) {
  const [menu, setMenu] = useState<TodayMenu | null>(initialMenu ?? null);
  const [loading, setLoading] = useState(!initialMenu);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");

  const people = useCartStore((state) => state.people);
  const goal = useCartStore((state) => state.goal);
  const setGoal = useCartStore((state) => state.setGoal);
  const setLines = useCartStore((state) => state.setLines);
  const addDish = useCartStore((state) => state.addDish);

  const loadMenu = useCallback(async () => {
    if (!initialMenu) setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/menu/today", {
        next: { tags: ["menu"] },
      });
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
  }, [initialMenu]);

  useEffect(() => {
    if (!initialMenu) {
      loadMenu();
    }
  }, [initialMenu, loadMenu]);

  if (loading) {
    return (
      <div className="border border-rule bg-white p-12 text-center font-mono text-xs font-bold uppercase tracking-[0.18em] text-muted">
        Đang tải thực đơn hôm nay…
      </div>
    );
  }

  if (error) {
    return (
      <div
        role="alert"
        className="mx-auto max-w-xl border-2 border-red-700 bg-white p-8 text-center"
      >
        <span className="font-mono text-xs font-bold uppercase tracking-[0.2em] text-red-700">
          Lỗi hệ thống
        </span>
        <h1 className="mt-2 font-display text-2xl font-bold text-forest">
          Chưa tải được thực đơn
        </h1>
        <p className="mt-2 text-sm text-ink/80">{error}</p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <button
            type="button"
            onClick={loadMenu}
            className="rounded-sm bg-coral px-6 py-3 font-mono text-xs font-bold uppercase tracking-[0.14em] text-white hover:bg-coral-hover focus-visible:outline-2 focus-visible:outline-coral"
          >
            Thử tải lại
          </button>
          <Link
            href="/"
            className="rounded-sm border-2 border-forest px-6 py-3 font-mono text-xs font-bold uppercase tracking-[0.14em] text-forest hover:bg-forest hover:text-white"
          >
            Về trang chủ
          </Link>
        </div>
      </div>
    );
  }

  if (!menu || menu.dishes.length === 0) {
    return (
      <div className="mx-auto max-w-xl border border-rule bg-white p-10 text-center">
        <span className="font-mono text-xs font-bold uppercase tracking-[0.2em] text-muted">
          Thông báo bếp
        </span>
        <h1 className="mt-2 font-display text-3xl font-bold text-forest">
          Hôm nay chưa có món nào mở bán
        </h1>
        <p className="mt-3 text-sm text-muted">
          Bếp chưa công bố thực đơn cho ngày hôm nay. Vui lòng quay lại sau nhé!
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <button
            type="button"
            onClick={loadMenu}
            className="rounded-sm bg-coral px-6 py-3 font-mono text-xs font-bold uppercase tracking-[0.14em] text-white hover:bg-coral-hover"
          >
            Kiểm tra lại
          </button>
          <Link
            href="/"
            className="rounded-sm border-2 border-forest px-6 py-3 font-mono text-xs font-bold uppercase tracking-[0.14em] text-forest hover:bg-forest hover:text-white"
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
        gramsPerPerson: item.grams,
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
    <div className="space-y-8">
      {/* Đầu trang thực đơn */}
      <header className="flex flex-col justify-between gap-4 border-b-2 border-forest pb-6 sm:flex-row sm:items-end">
        <div>
          <span className="font-mono text-xs font-bold uppercase tracking-[0.2em] text-coral">
            Khẩu phần định lượng · {people === 5 ? "5+" : people} người ăn
          </span>
          <h1 className="mt-2 font-display text-4xl font-bold tracking-tight text-forest sm:text-5xl">
            Thực đơn hôm nay
          </h1>
        </div>
        <p className="max-w-sm text-xs leading-relaxed text-muted sm:text-right">
          Định lượng hiển thị theo từng người, tổng khối lượng và giá tự nhân theo số người bạn chọn.
        </p>
      </header>

      {actionError && (
        <div
          role="alert"
          className="border-l-4 border-red-700 bg-white p-4 text-sm font-bold text-red-800 shadow-xs"
        >
          {actionError}
        </div>
      )}

      {/* Bố cục 2 cột: Trái (3 Combo + Món lẻ) / Phải (Sticky Customizer) */}
      <div className="grid gap-10 lg:grid-cols-12 lg:items-start">
        <div className="space-y-12 lg:col-span-7">
          {/* 3 Combo gợi ý */}
          <section className="space-y-4">
            <div className="flex items-baseline justify-between border-b border-rule pb-2.5">
              <h2 className="font-display text-2xl font-bold text-forest">
                3 combo gợi ý theo mục tiêu
              </h2>
              <span className="font-mono text-xs font-bold uppercase tracking-[0.16em] text-muted">
                Chọn nhanh
              </span>
            </div>

            {menu.combos.length === 0 ? (
              <p className="border border-rule bg-white p-5 text-sm text-muted">
                Chưa có combo gợi ý cho hôm nay. Bạn có thể tự ghép món lẻ bên dưới.
              </p>
            ) : (
              <div className="divide-y divide-rule border-y border-rule bg-white">
                {menu.combos.map((combo, idx) => {
                  const hasSoldOut = combo.items.some(
                    (item) =>
                      (item.dish.remaining_portions ?? item.dish.portion_limit) <=
                      0
                  );
                  const active = !hasSoldOut && goal === combo.goal;

                  return (
                    <button
                      key={combo.goal}
                      type="button"
                      onClick={() => chooseCombo(combo)}
                      className={`w-full border-l-4 p-5 text-left transition-all focus-visible:outline-2 focus-visible:outline-coral ${
                        hasSoldOut
                          ? "border-l-transparent bg-ivory/40 opacity-60 cursor-not-allowed"
                          : active
                            ? "border-l-coral bg-ivory/60 shadow-xs"
                            : "border-l-transparent hover:bg-ivory/30"
                      }`}
                    >
                      <div className="flex items-baseline justify-between gap-3">
                        <div className="flex items-baseline gap-3">
                          <span className="font-mono text-xs font-bold text-coral">
                            {String(idx + 1).padStart(2, "0")}
                          </span>
                          <span className="font-display text-xl font-bold text-forest">
                            {label[combo.goal]}
                          </span>
                        </div>

                        {hasSoldOut ? (
                          <span className="rounded-sm bg-red-100 px-2 py-0.5 font-mono text-[11px] font-bold uppercase text-red-700">
                            Có món hết suất
                          </span>
                        ) : (
                          <span
                            className={`font-mono text-xs font-bold uppercase tracking-wider ${
                              active ? "text-coral font-extrabold" : "text-forest"
                            }`}
                          >
                            {active ? "Đang áp dụng ✓" : "Chọn combo →"}
                          </span>
                        )}
                      </div>

                      <p className="mt-2 text-sm leading-relaxed text-ink/80">
                        {combo.items
                          .map((item) => `${item.dish.name} (${item.grams * people}g)`)
                          .join(" · ")}
                      </p>
                    </button>
                  );
                })}
              </div>
            )}
          </section>

          {/* Tự ghép món lẻ */}
          <section className="space-y-4">
            <div className="flex items-baseline justify-between border-b border-rule pb-2.5">
              <h2 className="font-display text-2xl font-bold text-forest">
                Tự ghép món lẻ theo khẩu vị
              </h2>
              <span className="font-mono text-xs font-bold uppercase tracking-[0.16em] text-muted">
                {menu.dishes.length} món mở bán
              </span>
            </div>

            <div className="divide-y divide-rule border-y border-rule bg-white">
              {menu.dishes.map((dish) => {
                const remaining = dish.remaining_portions ?? dish.portion_limit;
                const isSoldOut = remaining <= 0;

                return (
                  <article
                    key={dish.id}
                    className={`flex items-center justify-between gap-4 p-4 transition-colors sm:p-5 ${
                      isSoldOut ? "bg-ivory/40 opacity-60" : "hover:bg-ivory/20"
                    }`}
                  >
                    <div className="flex min-w-0 flex-1 items-center gap-4">
                      <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-full border-2 border-forest/30 bg-forest sm:h-20 sm:w-20">
                        {dish.image_url ? (
                          dish.image_url.startsWith("http") ||
                          dish.image_url.startsWith("/") ? (
                            <Image
                              src={dish.image_url}
                              alt={dish.name}
                              width={80}
                              height={80}
                              sizes="(max-width: 640px) 64px, 80px"
                              loading="lazy"
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <span className="grid h-full w-full place-items-center font-mono text-xs text-white">
                              MÓN
                            </span>
                          )
                        ) : (
                          <span className="grid h-full w-full place-items-center font-mono text-xs text-white">
                            MÓN
                          </span>
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-baseline gap-2.5">
                          <h3 className="font-display text-lg font-bold text-forest sm:text-xl">
                            {dish.name}
                          </h3>
                          {isSoldOut ? (
                            <span className="rounded-sm bg-red-100 px-2 py-0.5 font-mono text-[10px] font-bold uppercase text-red-700">
                              Hết suất
                            </span>
                          ) : remaining <= 5 ? (
                            <span className="rounded-sm bg-coral/15 px-2 py-0.5 font-mono text-[10px] font-bold uppercase text-coral">
                              Còn {remaining} suất
                            </span>
                          ) : null}
                        </div>

                        <p className="mt-1 font-mono text-xs text-muted">
                          Từ {dish.min_g * people}g ·{" "}
                          <strong className="text-coral">
                            {formatVnd(dish.price_vnd)}
                          </strong>{" "}
                          / hộp chuẩn {dish.yield_g}g
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      disabled={isSoldOut}
                      onClick={() => handleAddSingleDish(dish)}
                      className={`inline-flex min-h-[44px] shrink-0 items-center justify-center rounded-sm px-5 py-2.5 font-mono text-xs font-bold uppercase tracking-[0.14em] transition-all focus-visible:outline-2 focus-visible:outline-coral ${
                        isSoldOut
                          ? "cursor-not-allowed border border-rule bg-ivory text-muted"
                          : "border-2 border-forest bg-white text-forest hover:bg-forest hover:text-white active:scale-[0.98]"
                      }`}
                    >
                      {isSoldOut ? "Hết suất" : "+ Thêm món"}
                    </button>
                  </article>
                );
              })}
            </div>
          </section>
        </div>

        {/* Sticky Cột phải: Tùy chỉnh gram & Tạm tính */}
        <div className="lg:sticky lg:top-24 lg:col-span-5">
          <MealCustomizer />
        </div>
      </div>
    </div>
  );
}
