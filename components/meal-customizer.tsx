"use client";

import Image from "next/image";
import Link from "next/link";
import { calcPortion } from "@/lib/nutrition";
import { formatVnd } from "@/lib/format";
import { useCartStore } from "@/lib/cart-store";

export function MealCustomizer() {
  const people = useCartStore((state) => state.people);
  const lines = useCartStore((state) => state.lines);
  const changeGrams = useCartStore((state) => state.changeGrams);

  const totals = lines.reduce(
    (total, line) => {
      const grams = line.gramsPerPerson * people;
      const nutrition = calcPortion(line.dish.nutrition_per100, grams);
      const price = (line.dish.price_vnd / line.dish.yield_g) * grams;
      return {
        price: total.price + price,
        kcal: total.kcal + nutrition.kcal,
        protein: total.protein + nutrition.protein,
      };
    },
    { price: 0, kcal: 0, protein: 0 }
  );

  if (!lines.length) {
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
        {lines.map((line) => {
          const totalGrams = line.gramsPerPerson * people;
          const nutrition = calcPortion(line.dish.nutrition_per100, totalGrams);
          const price = (line.dish.price_vnd / line.dish.yield_g) * totalGrams;
          const canDecrease = line.gramsPerPerson > line.dish.min_g;
          const canIncrease = line.gramsPerPerson < line.dish.max_g;

          return (
            <article key={line.dish.id} className="py-4">
              <div className="flex items-start gap-3.5">
                <div className="relative grid h-16 w-16 shrink-0 place-items-center overflow-hidden border border-rule bg-white shadow-sm">
                  {line.dish.image_url ? (
                    line.dish.image_url.startsWith("http") ||
                    line.dish.image_url.startsWith("/") ? (
                      <Image
                        src={line.dish.image_url}
                        alt={line.dish.name}
                        width={64}
                        height={64}
                        sizes="64px"
                        loading="lazy"
                        className="h-full w-full object-cover transition-transform duration-300 hover:scale-105"
                      />
                    ) : (
                      <span className="font-mono text-[10px] font-bold text-forest">MÓN</span>
                    )
                  ) : (
                    <span className="font-mono text-[10px] font-bold text-forest">MÓN</span>
                  )}
                </div>

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
                    <strong className="text-forest font-semibold">{line.gramsPerPerson}g/người</strong> · {totalGrams}g cả bữa
                  </p>
                  <p className="font-mono text-[11px] text-muted">
                    {Math.round(nutrition.kcal)} kcal · Protein {nutrition.protein.toFixed(1)}g
                  </p>
                </div>
              </div>

              <div className="mt-3.5 flex items-center justify-between">
                <span className="font-mono text-[11px] font-medium tracking-[0.1em] text-muted">
                  Bước cân ±{line.dish.step_g}g
                </span>

                {/* Bộ điều khiển tăng giảm: tap target 40-44px, affordance rõ ràng */}
                <div className="flex items-center border border-forest/30 bg-white shadow-sm">
                  <button
                    type="button"
                    aria-label={`Giảm ${line.dish.name}`}
                    onClick={() =>
                      changeGrams(
                        line.dish.id,
                        line.gramsPerPerson - line.dish.step_g
                      )
                    }
                    disabled={!canDecrease}
                    className="grid h-10 w-10 place-items-center font-mono text-lg font-bold text-forest transition-colors hover:bg-forest hover:text-white disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-forest"
                  >
                    −
                  </button>
                  <span className="min-w-20 px-2 text-center font-mono text-xs font-bold tabular-nums text-ink">
                    {line.gramsPerPerson}g
                  </span>
                  <button
                    type="button"
                    aria-label={`Tăng ${line.dish.name}`}
                    onClick={() =>
                      changeGrams(
                        line.dish.id,
                        line.gramsPerPerson + line.dish.step_g
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
            Tạm tính · {people} người ăn
          </span>
          <span className="font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-coral">
            {lines.length} món đã chọn
          </span>
        </div>

        <p className="mt-4 font-display text-3xl font-semibold tracking-tight text-white">
          {formatVnd(Math.round(totals.price))}
        </p>
        <p className="mt-1 font-mono text-xs text-ivory/90">
          ≈ {Math.round(totals.kcal)} kcal · Protein {totals.protein.toFixed(1)}g (ước tính)
        </p>

        <div className="mt-4 border-t border-white/15 pt-3 font-mono text-[11px] text-ivory/70">
          Chia đều mỗi người: {formatVnd(Math.round(totals.price / people))} ·{" "}
          {Math.round(totals.kcal / people)} kcal · P {(totals.protein / people).toFixed(1)}g
        </div>

        {/* Primary CTA Coral Orange */}
        <Link
          href="/cart"
          className="mt-6 flex w-full items-center justify-center gap-2 bg-coral py-4 text-center font-mono text-xs font-bold uppercase tracking-[0.16em] text-white shadow-md transition-all hover:bg-coral-hover hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral focus-visible:ring-offset-2"
        >
          <span>Đến giỏ hàng &amp; đặt món ({lines.length} món)</span>
          <span aria-hidden="true">→</span>
        </Link>
      </section>
    </section>
  );
}
