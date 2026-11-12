"use client";
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
        protein: total.protein + nutrition.protein
      };
    },
    { price: 0, kcal: 0, protein: 0 }
  );

  if (!lines.length) {
    return (
      <div className="rounded-card border border-dashed border-brand-200 bg-white p-5 text-center text-sm text-slate-600 shadow-sm">
        Chọn một combo hoặc thêm món lẻ ở trên để bắt đầu tùy chỉnh định lượng.
      </div>
    );
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-xl font-black text-brand-950">Tùy chỉnh bữa ăn</h2>
        <Link
          href="/cart"
          className="text-xs font-bold text-orange-600 underline hover:text-orange-700"
        >
          Xem chi tiết giỏ hàng →
        </Link>
      </div>

      {lines.map((line) => {
        const totalGrams = line.gramsPerPerson * people;
        const nutrition = calcPortion(line.dish.nutrition_per100, totalGrams);
        const price = (line.dish.price_vnd / line.dish.yield_g) * totalGrams;
        return (
          <article key={line.dish.id} className="rounded-card bg-white p-4 shadow-soft">
            <div className="flex gap-3">
              <div className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-xl bg-brand-50 text-2xl">
                {line.dish.image_url ? (
                  line.dish.image_url.startsWith("http") || line.dish.image_url.startsWith("/") ? (
                    <>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={line.dish.image_url}
                        alt={line.dish.name}
                        className="h-full w-full rounded-xl object-cover"
                      />
                    </>
                  ) : (
                    line.dish.image_url
                  )
                ) : (
                  "🍱"
                )}
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="font-bold">{line.dish.name}</h3>
                <p className="text-xs text-slate-500">
                  {line.gramsPerPerson}g/người · {totalGrams}g cả bữa
                </p>
                <p className="mt-1 text-sm font-bold text-brand-700">
                  {formatVnd(Math.round(price))} · {Math.round(nutrition.kcal)} kcal · P{" "}
                  {nutrition.protein.toFixed(1)}g
                </p>
              </div>
            </div>
            <div className="mt-3 flex items-center justify-between">
              <button
                aria-label={`Giảm ${line.dish.name}`}
                onClick={() => changeGrams(line.dish.id, line.gramsPerPerson - line.dish.step_g)}
                disabled={line.gramsPerPerson <= line.dish.min_g}
                className="grid h-10 w-10 place-items-center rounded-full border text-xl disabled:opacity-30"
              >
                −
              </button>
              <span className="text-sm font-semibold">Bước {line.dish.step_g}g</span>
              <button
                aria-label={`Tăng ${line.dish.name}`}
                onClick={() => changeGrams(line.dish.id, line.gramsPerPerson + line.dish.step_g)}
                disabled={line.gramsPerPerson >= line.dish.max_g}
                className="grid h-10 w-10 place-items-center rounded-full bg-brand-700 text-xl text-white disabled:opacity-30"
              >
                +
              </button>
            </div>
          </article>
        );
      })}

      <section className="rounded-card bg-brand-950 p-5 text-white shadow-md">
        <p className="text-sm text-brand-100">Tổng cả bữa · {people} người</p>
        <p className="mt-1 text-2xl font-black">{formatVnd(Math.round(totals.price))}</p>
        <p className="mt-2 text-sm">
          {Math.round(totals.kcal)} kcal · Protein {totals.protein.toFixed(1)}g
        </p>
        <div className="mt-4 border-t border-brand-700 pt-3 text-sm text-brand-100">
          Nếu chia đều: {formatVnd(Math.round(totals.price / people))}/người ·{" "}
          {Math.round(totals.kcal / people)} kcal/người · P{" "}
          {(totals.protein / people).toFixed(1)}g/người
        </div>
        <Link
          href="/cart"
          className="mt-4 block w-full rounded-full bg-orange-500 py-3.5 text-center font-bold text-white shadow-md transition hover:bg-orange-600"
        >
          Đến giỏ hàng & Đặt món ({lines.length} món)
        </Link>
      </section>
    </section>
  );
}
