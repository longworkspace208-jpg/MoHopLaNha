"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCartStore, roundToStep, sanitizeCartLine, type CartLine } from "@/lib/cart-store";
import { calcPortion } from "@/lib/nutrition";
import { formatVnd } from "@/lib/format";
import { DELIVERY_CONFIG } from "@/lib/delivery-config";

export default function CartPage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  const people = useCartStore((state) => state.people);
  const lines = useCartStore((state) => state.lines);
  const changeGrams = useCartStore((state) => state.changeGrams);
  const removeDish = useCartStore((state) => state.removeDish);

  useEffect(() => {
    setMounted(true);
  }, []);

  const validLines = useMemo(() => {
    return lines
      .map((line) => sanitizeCartLine(line, people))
      .filter((line): line is CartLine => Boolean(line));
  }, [lines, people]);

  const subtotal = useMemo(() => {
    return validLines.reduce((sum, line) => {
      const yieldG = line.dish.yield_g > 0 ? line.dish.yield_g : 350;
      const itemPrice = (line.dish.price_vnd / yieldG) * line.grams;
      return sum + (Number.isFinite(itemPrice) ? itemPrice : 0);
    }, 0);
  }, [validLines]);

  const totalNutrition = useMemo(() => {
    return validLines.reduce(
      (total, line) => {
        const macro = calcPortion(line.dish.nutrition_per100, line.grams);
        return {
          kcal: total.kcal + (Number.isFinite(macro.kcal) ? macro.kcal : 0),
          protein: total.protein + (Number.isFinite(macro.protein) ? macro.protein : 0),
          carbs: total.carbs + (Number.isFinite(macro.carbs) ? macro.carbs : 0),
          fat: total.fat + (Number.isFinite(macro.fat) ? macro.fat : 0),
        };
      },
      { kcal: 0, protein: 0, carbs: 0, fat: 0 }
    );
  }, [validLines]);

  const shippingFee = validLines.length > 0 ? DELIVERY_CONFIG.shippingFeeVnd : 0;
  const finalTotal = subtotal + shippingFee;

  if (!mounted) {
    return (
      <main className="mx-auto min-h-screen max-w-6xl px-4 py-16 sm:px-6 lg:px-10">
        <p className="font-mono text-xs font-semibold uppercase tracking-[0.16em] text-muted">
          Đang tải giỏ hàng…
        </p>
      </main>
    );
  }

  if (validLines.length === 0) {
    return (
      <main className="mx-auto min-h-screen max-w-2xl px-4 py-16 sm:px-6">
        <div className="border border-rule bg-white p-8 text-center shadow-sm sm:p-12">
          <p className="font-mono text-[11px] font-bold uppercase tracking-[0.2em] text-coral">
            Khay cơm đang trống
          </p>
          <h1 className="mt-3 font-display text-3xl font-semibold text-forest sm:text-4xl">
            Chưa có món nào trong giỏ
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-muted">
            Bạn chưa chọn món nào cho bữa ăn. Hãy chọn số người hoặc ghé xem thực đơn nấu mới hôm nay nhé.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link
              href="/menu"
              className="bg-coral px-6 py-3.5 font-mono text-xs font-bold uppercase tracking-[0.16em] text-white shadow-sm transition-all hover:bg-coral-hover hover:shadow-md"
            >
              Xem thực đơn hôm nay
            </Link>
            <Link
              href="/"
              className="border-2 border-forest bg-transparent px-6 py-3.5 font-mono text-xs font-bold uppercase tracking-[0.16em] text-forest transition-colors hover:bg-forest hover:text-white"
            >
              Chọn lại số người
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto min-h-screen max-w-6xl px-4 pb-20 pt-8 sm:px-6 lg:px-10">
      <header className="flex flex-col justify-between gap-4 border-b-2 border-forest pb-5 sm:flex-row sm:items-end">
        <div>
          <p className="font-mono text-[11px] font-bold uppercase tracking-[0.2em] text-coral">
            Khẩu phần định lượng · {people} người ăn
          </p>
          <h1 className="mt-1 font-display text-4xl font-semibold tracking-[-0.02em] text-forest">
            Giỏ hàng của bạn
          </h1>
        </div>
        <Link
          href="/menu"
          className="border-b-2 border-forest pb-0.5 font-mono text-xs font-bold uppercase tracking-[0.14em] text-forest transition-colors hover:border-coral hover:text-coral"
        >
          + Thêm món khác vào giỏ
        </Link>
      </header>

      <div className="mt-8 grid gap-10 lg:grid-cols-12 lg:items-start">
        {/* Cột trái: Danh sách món ngăn cách bởi hairline */}
        <section className="divide-y divide-rule border-b border-rule lg:col-span-7">
          {validLines.map((line) => {
            const grams = Number.isFinite(line.grams) && line.grams > 0 ? line.grams : (line.dish.min_g || 200);
            const stepG = line.dish.step_g > 0 ? line.dish.step_g : 50;
            const yieldG = line.dish.yield_g > 0 ? line.dish.yield_g : 350;
            const suggestedGrams = roundToStep(
              (line.baseGrams ?? line.dish.min_g ?? 200) * people,
              stepG
            );
            const nutrition = calcPortion(line.dish.nutrition_per100, grams);
            const price = Math.round(
              (line.dish.price_vnd / yieldG) * grams
            );

            const minG = line.dish.min_g > 0 ? line.dish.min_g : 200;
            const maxG = (line.dish.max_g >= minG ? line.dish.max_g : 500) * people;
            const canDecrease = grams > minG;
            const canIncrease = grams < maxG;

            return (
              <article key={line.dish.id} className="py-6 first:pt-0">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-4">
                    {line.dish.image_url &&
                    (line.dish.image_url.startsWith("http") || line.dish.image_url.startsWith("/")) ? (
                      <div className="relative grid h-16 w-16 shrink-0 place-items-center overflow-hidden border border-rule bg-white sm:h-20 sm:w-20 shadow-sm">
                        <Image
                          src={line.dish.image_url}
                          alt={line.dish.name}
                          width={80}
                          height={80}
                          sizes="80px"
                          loading="lazy"
                          className="h-full w-full object-cover"
                        />
                      </div>
                    ) : null}

                    <div>
                      <h2 className="font-display text-xl font-semibold text-ink">
                        {line.dish.name}
                      </h2>
                      <p className="mt-1 font-mono text-xs text-muted">
                        <strong className="text-forest font-semibold">{grams}g</strong> (tổng lượng đặt)
                      </p>
                      <p className="mt-0.5 text-[11px] leading-snug text-muted">
                        Gợi ý cho {people} người: {suggestedGrams} g. Số gram ở đây là tổng lượng bạn đặt.
                      </p>
                      <p className="mt-1.5 font-mono text-base font-bold tabular-nums text-coral">
                        {formatVnd(price)}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => removeDish(line.dish.id)}
                    className="border-b border-transparent font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-muted transition-colors hover:border-red-700 hover:text-red-700"
                    title="Xóa món"
                    aria-label={`Xóa món ${line.dish.name}`}
                  >
                    Xóa món
                  </button>
                </div>

                <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
                  {/* Bảng macro dạng inline monospace */}
                  <div className="flex flex-wrap gap-x-4 gap-y-1 font-mono text-xs tabular-nums text-muted">
                    <span>{Math.round(nutrition.kcal || 0)} kcal</span>
                    <span className="text-forest font-semibold">P {(nutrition.protein ?? 0).toFixed(1)}g</span>
                    <span>C {(nutrition.carbs ?? 0).toFixed(1)}g</span>
                    <span>F {(nutrition.fat ?? 0).toFixed(1)}g</span>
                  </div>

                  {/* Bộ tăng giảm gram kiểu editorial */}
                  <div className="flex items-center border border-forest/30 bg-white shadow-sm">
                    <button
                      type="button"
                      onClick={() =>
                        changeGrams(
                          line.dish.id,
                          Math.max(minG, grams - stepG),
                          true
                        )
                      }
                      disabled={!canDecrease}
                      className="grid h-10 w-10 place-items-center font-mono text-lg font-bold text-forest transition-colors hover:bg-forest hover:text-white disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-forest"
                      aria-label={`Giảm định lượng ${line.dish.name}`}
                    >
                      −
                    </button>
                    <span className="min-w-28 px-3 text-center font-mono text-xs font-bold tabular-nums text-ink">
                      {grams}g
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        changeGrams(
                          line.dish.id,
                          Math.min(maxG, grams + stepG),
                          true
                        )
                      }
                      disabled={!canIncrease}
                      className="grid h-10 w-10 place-items-center font-mono text-lg font-bold text-forest transition-colors hover:bg-forest hover:text-white disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-forest"
                      aria-label={`Tăng định lượng ${line.dish.name}`}
                    >
                      +
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </section>

        {/* Cột phải: Bảng tóm tắt dinh dưỡng & hóa đơn */}
        <aside className="space-y-6 lg:sticky lg:top-24 lg:col-span-5">
          {/* Dinh dưỡng cả bữa */}
          <section className="border border-rule bg-white p-5 shadow-sm">
            <h3 className="border-b border-rule pb-2.5 font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-forest">
              Tổng dinh dưỡng cả bữa (ước tính)
            </h3>
            <dl className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-2">
              <div>
                <dt className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">
                  Calories
                </dt>
                <dd className="mt-0.5 font-mono text-lg font-bold tabular-nums text-ink">
                  {Math.round(totalNutrition.kcal || 0)} kcal
                </dd>
              </div>
              <div>
                <dt className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">
                  Protein
                </dt>
                <dd className="mt-0.5 font-mono text-lg font-bold tabular-nums text-forest">
                  {(totalNutrition.protein ?? 0).toFixed(1)}g
                </dd>
              </div>
              <div>
                <dt className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">
                  Carbs
                </dt>
                <dd className="mt-0.5 font-mono text-lg font-bold tabular-nums text-ink">
                  {(totalNutrition.carbs ?? 0).toFixed(1)}g
                </dd>
              </div>
              <div>
                <dt className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">
                  Fat
                </dt>
                <dd className="mt-0.5 font-mono text-lg font-bold tabular-nums text-coral">
                  {(totalNutrition.fat ?? 0).toFixed(1)}g
                </dd>
              </div>
            </dl>
            <div className="mt-4 border-t border-rule pt-2.5 font-mono text-[11px] text-muted leading-relaxed">
              Bình quân mỗi người nếu chia đều ({people} người): {formatVnd(Math.round(subtotal / Math.max(1, people)))} · {Math.round((totalNutrition.kcal || 0) / Math.max(1, people))} kcal · P {(((totalNutrition.protein || 0) / Math.max(1, people))).toFixed(1)}g (ước tính)
            </div>
          </section>

          {/* Hóa đơn thanh toán Deep Forest Green */}
          <section className="bg-forest p-6 text-white shadow-sm">
            <h3 className="border-b border-white/20 pb-3 font-display text-xl font-semibold text-white">
              Tóm tắt thanh toán
            </h3>
            <div className="mt-4 space-y-3 text-sm">
              <div className="flex justify-between text-ivory/80">
                <span>Tạm tính món ăn</span>
                <span className="font-mono font-bold tabular-nums text-white">
                  {formatVnd(Math.round(subtotal))}
                </span>
              </div>
              <div className="flex justify-between text-ivory/80">
                <span>Phí giao hàng (nội thành)</span>
                <span className="font-mono font-bold tabular-nums text-white">
                  {formatVnd(shippingFee)}
                </span>
              </div>
              <div className="flex items-baseline justify-between border-t border-white/20 pt-4">
                <span className="font-display text-lg font-semibold text-white">
                  Tổng thanh toán
                </span>
                <span className="font-display text-3xl font-bold text-coral">
                  {formatVnd(Math.round(finalTotal))}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => router.push("/checkout")}
              className="mt-6 flex w-full items-center justify-center gap-2 bg-coral py-4 text-center font-mono text-xs font-bold uppercase tracking-[0.16em] text-white shadow-md transition-all hover:bg-coral-hover hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral focus-visible:ring-offset-2"
            >
              <span>Tiến hành đặt hàng · {formatVnd(Math.round(finalTotal))}</span>
              <span aria-hidden="true">→</span>
            </button>
          </section>
        </aside>
      </div>
    </main>
  );
}
