"use client";

import { useMemo } from "react";
import Image from "next/image";
import Link from "next/link";
import { calcPortion } from "@/lib/nutrition";
import { formatVnd } from "@/lib/format";
import { useCartStore, roundToStep, sanitizeCartLine, type CartLine } from "@/lib/cart-store";

export function MealCustomizer() {
  const people = useCartStore((state) => state.people);
  const lines = useCartStore((state) => state.lines);
  const changeGrams = useCartStore((state) => state.changeGrams);

  const validLines = useMemo(() => {
    return lines
      .map((line) => sanitizeCartLine(line, people))
      .filter((line): line is CartLine => Boolean(line));
  }, [lines, people]);

  const totals = useMemo(() => {
    return validLines.reduce(
      (total, line) => {
        const grams = line.grams;
        const yieldG = line.dish.yield_g > 0 ? line.dish.yield_g : 350;
        const nutrition = calcPortion(line.dish.nutrition_per100, grams);
        const price = (line.dish.price_vnd / yieldG) * grams;
        return {
          price: total.price + (Number.isFinite(price) ? price : 0),
          kcal: total.kcal + (Number.isFinite(nutrition.kcal) ? nutrition.kcal : 0),
          protein: total.protein + (Number.isFinite(nutrition.protein) ? nutrition.protein : 0),
        };
      },
      { price: 0, kcal: 0, protein: 0 }
    );
  }, [validLines]);

  if (!validLines.length) {
    return (
      <div className="border border-dashed border-forest/30 bg-white/60 p-6 text-sm text-muted">
        <p className="font-mono text-[11px] font-bold uppercase tracking-[0.2em] text-coral">
          Khay cơm đang trống
        </p>
        <p className="mt-2 text-ink leading-relaxed">
          Chọn một combo gợi ý hoặc bấm <strong>+ Thêm vào khay</strong> ở danh sách món để bắt đầu cân chỉnh gram cho {people} người.
        </p>
        <div className="mt-4 pt-3 border-t border-rule text-xs text-muted flex items-center gap-2">
          <span className="inline-block h-2 w-2 rounded-full bg-forest"></span>
          <span>Định lượng tính theo từng gam thực tế trước khi đóng hộp.</span>
        </div>
      </div>
    );
  }

  return (
    <section className="space-y-6">
      <div className="flex items-baseline justify-between border-b-2 border-forest pb-3">
        <div>
          <span className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-coral">
            Định lượng khẩu phần
          </span>
          <h2 className="mt-0.5 font-display text-2xl font-semibold text-forest">
            Tùy chỉnh bữa ăn
          </h2>
        </div>
        <Link
          href="/cart"
          className="border-b-2 border-forest pb-0.5 font-mono text-xs font-bold uppercase tracking-[0.14em] text-forest transition-colors hover:border-coral hover:text-coral"
        >
          Xem giỏ hàng →
        </Link>
      </div>

      <div className="divide-y divide-rule border-b border-rule">
        {validLines.map((line) => {
          const grams = Number.isFinite(line.grams) && line.grams > 0 ? line.grams : (line.dish.min_g || 200);
          const stepG = line.dish.step_g > 0 ? line.dish.step_g : 50;
          const yieldG = line.dish.yield_g > 0 ? line.dish.yield_g : 350;
          const suggestedGrams = roundToStep(
            (line.baseGrams ?? line.dish.min_g ?? 200) * people,
            stepG
          );
          const nutrition = calcPortion(line.dish.nutrition_per100, grams);
          const price = (line.dish.price_vnd / yieldG) * grams;
          const minG = line.dish.min_g > 0 ? line.dish.min_g : 200;
          const maxG = (line.dish.max_g >= minG ? line.dish.max_g : 500) * people;
          const canDecrease = grams > minG;
          const canIncrease = grams < maxG;

          return (
            <article key={line.dish.id} className="py-4">
              <div className="flex items-start gap-3.5">
                {line.dish.image_url &&
                (line.dish.image_url.startsWith("http") || line.dish.image_url.startsWith("/")) ? (
                  <div className="relative grid h-16 w-16 shrink-0 place-items-center overflow-hidden border border-rule bg-white shadow-sm">
                    <Image
                      src={line.dish.image_url}
                      alt={line.dish.name}
                      width={64}
                      height={64}
                      sizes="64px"
                      loading="lazy"
                      className="h-full w-full object-cover transition-transform duration-300 hover:scale-105"
                    />
                  </div>
                ) : null}

                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <h3 className="font-display text-lg font-semibold text-ink">
                      {line.dish.name}
                    </h3>
                    <span className="shrink-0 font-mono text-base font-bold tabular-nums text-coral">
                      {formatVnd(Math.round(price))}
                    </span>
                  </div>
                  <p className="mt-1 font-mono text-xs text-muted">
                    <strong className="text-forest font-semibold">{grams}g</strong> (tổng lượng đặt)
                  </p>
                  <p className="mt-0.5 text-[11px] leading-snug text-muted">
                    Gợi ý cho {people} người: {suggestedGrams} g. Số gram ở đây là tổng lượng bạn đặt.
                  </p>
                  <p className="mt-1 font-mono text-[11px] text-muted">
                    {Math.round(nutrition.kcal || 0)} kcal · Protein {(nutrition.protein ?? 0).toFixed(1)}g
                  </p>
                </div>
              </div>

              <div className="mt-3.5 flex items-center justify-between">
                <span className="font-mono text-[11px] font-medium tracking-[0.1em] text-muted">
                  Bước cân ±{stepG}g (tối đa {maxG}g)
                </span>

                {/* Bộ điều khiển tăng giảm: tap target 40-44px, affordance rõ ràng */}
                <div className="flex items-center border border-forest/30 bg-white shadow-sm">
                  <button
                    type="button"
                    aria-label={`Giảm ${line.dish.name}`}
                    onClick={() =>
                      changeGrams(
                        line.dish.id,
                        Math.max(minG, grams - stepG),
                        true
                      )
                    }
                    disabled={!canDecrease}
                    className="grid h-10 w-10 place-items-center font-mono text-lg font-bold text-forest transition-colors hover:bg-forest hover:text-white disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-forest"
                  >
                    −
                  </button>
                  <span className="min-w-20 px-2 text-center font-mono text-xs font-bold tabular-nums text-ink">
                    {grams}g
                  </span>
                  <button
                    type="button"
                    aria-label={`Tăng ${line.dish.name}`}
                    onClick={() =>
                      changeGrams(
                        line.dish.id,
                        Math.min(maxG, grams + stepG),
                        true
                      )
                    }
                    disabled={!canIncrease}
                    className="grid h-10 w-10 place-items-center font-mono text-lg font-bold text-forest transition-colors hover:bg-forest hover:text-white disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-forest"
                  >
                    +
                  </button>
                </div>
              </div>
            </article>
          );
        })}
      </div>

      {/* Bảng tổng hợp Deep Forest Green */}
      <section className="bg-forest p-6 text-white shadow-sm">
        <div className="flex items-baseline justify-between border-b border-white/20 pb-3">
          <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-ivory/80">
            Tạm tính · {validLines.length} món trong khay
          </span>
          <span className="font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-coral">
            Bàn {people} người
          </span>
        </div>

        <p className="mt-4 font-display text-3xl font-semibold tracking-tight text-white">
          {formatVnd(Math.round(totals.price))}
        </p>
        <p className="mt-1 font-mono text-xs text-ivory/90">
          ≈ {Math.round(totals.kcal)} kcal · Protein {(totals.protein ?? 0).toFixed(1)}g (ước tính cả bữa)
        </p>

        <div className="mt-4 border-t border-white/15 pt-3 font-mono text-[11px] text-ivory/70">
          Bình quân mỗi người nếu chia đều: {formatVnd(Math.round(totals.price / Math.max(1, people)))} ·{" "}
          {Math.round(totals.kcal / Math.max(1, people))} kcal · P {(((totals.protein ?? 0) / Math.max(1, people))).toFixed(1)}g (ước tính)
        </div>

        {/* Primary CTA Coral Orange */}
        <Link
          href="/cart"
          className="mt-6 flex w-full items-center justify-center gap-2 bg-coral py-4 text-center font-mono text-xs font-bold uppercase tracking-[0.16em] text-white shadow-md transition-all hover:bg-coral-hover hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral focus-visible:ring-offset-2"
        >
          <span>Đến giỏ hàng &amp; đặt món ({validLines.length} món)</span>
          <span aria-hidden="true">→</span>
        </Link>
      </section>
    </section>
  );
}
