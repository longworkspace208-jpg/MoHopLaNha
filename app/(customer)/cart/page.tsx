"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCartStore } from "@/lib/cart-store";
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

  if (!mounted) {
    return (
      <main className="mx-auto min-h-screen max-w-lg px-4 py-8">
        <p className="text-center text-sm text-slate-500">Đang tải giỏ hàng…</p>
      </main>
    );
  }

  // Tính toán tài chính & dinh dưỡng
  const subtotal = lines.reduce((sum, line) => {
    const totalGrams = line.gramsPerPerson * people;
    const itemPrice = (line.dish.price_vnd / line.dish.yield_g) * totalGrams;
    return sum + itemPrice;
  }, 0);

  const totalNutrition = lines.reduce(
    (total, line) => {
      const totalGrams = line.gramsPerPerson * people;
      const macro = calcPortion(line.dish.nutrition_per100, totalGrams);
      return {
        kcal: total.kcal + macro.kcal,
        protein: total.protein + macro.protein,
        carbs: total.carbs + macro.carbs,
        fat: total.fat + macro.fat
      };
    },
    { kcal: 0, protein: 0, carbs: 0, fat: 0 }
  );

  const shippingFee = lines.length > 0 ? DELIVERY_CONFIG.shippingFeeVnd : 0;
  const finalTotal = subtotal + shippingFee;

  if (lines.length === 0) {
    return (
      <main className="mx-auto min-h-screen max-w-lg px-4 py-12">
        <div className="rounded-3xl bg-white p-8 text-center shadow-sm">
          <div className="text-5xl">🍱</div>
          <h1 className="mt-4 text-2xl font-black text-brand-950">Giỏ hàng đang trống</h1>
          <p className="mt-2 text-sm text-slate-600">
            Bạn chưa chọn món nào cho bữa ăn. Hãy chọn số người hoặc ghé xem thực đơn hôm nay nhé!
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link
              href="/menu"
              className="rounded-full bg-orange-500 px-6 py-3.5 text-sm font-bold text-white shadow-md transition hover:bg-orange-600"
            >
              Xem thực đơn hôm nay
            </Link>
            <Link
              href="/"
              className="rounded-full bg-brand-50 px-5 py-3.5 text-sm font-bold text-brand-800 transition hover:bg-brand-100"
            >
              Chọn lại số người
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto min-h-screen max-w-lg px-4 pb-16 pt-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-brand-950">Giỏ hàng của bạn</h1>
          <p className="text-xs text-slate-500">Phục vụ cho {people} người ăn</p>
        </div>
        <Link
          href="/menu"
          className="text-xs font-bold text-brand-700 underline hover:text-brand-800"
        >
          + Thêm món khác
        </Link>
      </div>

      {/* Danh sách món trong giỏ hàng */}
      <section className="mt-5 space-y-3">
        {lines.map((line) => {
          const totalGrams = line.gramsPerPerson * people;
          const nutrition = calcPortion(line.dish.nutrition_per100, totalGrams);
          const price = Math.round((line.dish.price_vnd / line.dish.yield_g) * totalGrams);

          const canDecrease = line.gramsPerPerson > line.dish.min_g;
          const canIncrease = line.gramsPerPerson < line.dish.max_g;

          return (
            <article
              key={line.dish.id}
              className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
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
                  <div>
                    <h2 className="text-base font-bold text-brand-950">{line.dish.name}</h2>
                    <p className="text-xs text-slate-500">
                      {line.gramsPerPerson}g/người · <strong>{totalGrams}g</strong> cả bữa
                    </p>
                    <p className="mt-1 text-sm font-black text-brand-700">
                      {formatVnd(price)}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => removeDish(line.dish.id)}
                  className="rounded-lg p-1.5 text-xs font-semibold text-slate-400 transition hover:bg-red-50 hover:text-red-600"
                  title="Xóa món"
                  aria-label={`Xóa món ${line.dish.name}`}
                >
                  Xóa
                </button>
              </div>

              {/* Dinh dưỡng của món */}
              <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-slate-500">
                <span className="rounded bg-slate-100 px-2 py-0.5 font-medium">
                  {Math.round(nutrition.kcal)} kcal
                </span>
                <span className="rounded bg-emerald-50 px-2 py-0.5 font-medium text-emerald-700">
                  Protein {nutrition.protein.toFixed(1)}g
                </span>
                <span className="rounded bg-amber-50 px-2 py-0.5 font-medium text-amber-800">
                  Carbs {nutrition.carbs.toFixed(1)}g
                </span>
                <span className="rounded bg-blue-50 px-2 py-0.5 font-medium text-blue-700">
                  Fat {nutrition.fat.toFixed(1)}g
                </span>
              </div>

              {/* Điều chỉnh gram */}
              <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3">
                <span className="text-xs font-medium text-slate-500">
                  Định lượng (bước {line.dish.step_g}g)
                </span>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() =>
                      changeGrams(line.dish.id, line.gramsPerPerson - line.dish.step_g)
                    }
                    disabled={!canDecrease}
                    className="grid h-8 w-8 place-items-center rounded-full border border-slate-200 bg-white text-base font-bold text-slate-700 transition hover:bg-slate-50 disabled:opacity-30"
                    aria-label={`Giảm định lượng ${line.dish.name}`}
                  >
                    −
                  </button>
                  <span className="min-w-16 text-center text-xs font-bold text-slate-800">
                    {line.gramsPerPerson}g/người
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      changeGrams(line.dish.id, line.gramsPerPerson + line.dish.step_g)
                    }
                    disabled={!canIncrease}
                    className="grid h-8 w-8 place-items-center rounded-full bg-brand-700 text-base font-bold text-white transition hover:bg-brand-800 disabled:opacity-30"
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

      {/* Tóm tắt dinh dưỡng cả bữa */}
      <section className="mt-5 rounded-2xl bg-brand-50 p-4 text-brand-950">
        <h3 className="text-xs font-bold uppercase tracking-wider text-brand-700">
          Tổng dinh dưỡng cả bữa ({people} người)
        </h3>
        <div className="mt-2 grid grid-cols-2 gap-2 text-center sm:grid-cols-4">
          <div className="rounded-xl bg-white p-2 shadow-xs">
            <span className="block text-xs text-slate-500">Calories</span>
            <strong className="text-sm font-black text-brand-950">
              {Math.round(totalNutrition.kcal)}
            </strong>
          </div>
          <div className="rounded-xl bg-white p-2 shadow-xs">
            <span className="block text-xs text-slate-500">Protein</span>
            <strong className="text-sm font-black text-emerald-700">
              {totalNutrition.protein.toFixed(1)}g
            </strong>
          </div>
          <div className="rounded-xl bg-white p-2 shadow-xs">
            <span className="block text-xs text-slate-500">Carbs</span>
            <strong className="text-sm font-black text-amber-800">
              {totalNutrition.carbs.toFixed(1)}g
            </strong>
          </div>
          <div className="rounded-xl bg-white p-2 shadow-xs">
            <span className="block text-xs text-slate-500">Fat</span>
            <strong className="text-sm font-black text-blue-700">
              {totalNutrition.fat.toFixed(1)}g
            </strong>
          </div>
        </div>
      </section>

      {/* Chi tiết thanh toán: Tạm tính, Phí ship, Tổng */}
      <section className="mt-5 space-y-2.5 rounded-2xl bg-white p-5 shadow-sm">
        <h3 className="text-sm font-bold text-brand-950">Tóm tắt thanh toán</h3>
        <div className="flex justify-between text-sm text-slate-600">
          <span>Tạm tính món ăn</span>
          <span className="font-semibold">{formatVnd(Math.round(subtotal))}</span>
        </div>
        <div className="flex justify-between text-sm text-slate-600">
          <span>Phí giao hàng (nội thành)</span>
          <span className="font-semibold">{formatVnd(shippingFee)}</span>
        </div>
        <div className="border-t border-slate-100 pt-3 flex justify-between text-base font-black text-brand-950">
          <span>Tổng thanh toán</span>
          <span className="text-xl text-orange-600">{formatVnd(Math.round(finalTotal))}</span>
        </div>
      </section>

      {/* Nút tiến hành đặt hàng */}
      <div className="mt-6">
        <button
          type="button"
          onClick={() => router.push("/checkout")}
          className="w-full rounded-full bg-orange-500 py-4 text-center font-black text-white shadow-lg transition hover:bg-orange-600"
        >
          Tiến hành đặt hàng · {formatVnd(Math.round(finalTotal))}
        </button>
      </div>
    </main>
  );
}

