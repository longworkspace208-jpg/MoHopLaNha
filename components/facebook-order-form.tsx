"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { DELIVERY_CONFIG, validateServiceArea } from "@/lib/delivery-config";
import { calcPortion, type Macros } from "@/lib/nutrition";
import { formatVnd } from "@/lib/format";

type MenuDish = {
  id: string;
  name: string;
  price_vnd: number;
  image_url?: string | null;
  yield_g: number;
  step_g?: number;
  min_g?: number;
  max_g?: number;
  nutrition_per100: Macros;
};

type DishSelection = {
  included: boolean;
  grams: number;
};

export function FacebookOrderForm() {
  const router = useRouter();

  const [dishes, setDishes] = useState<MenuDish[]>([]);
  const [loadingDishes, setLoadingDishes] = useState(true);
  const [dishesError, setDishesError] = useState("");
  const [selected, setSelected] = useState<Record<string, DishSelection>>({});

  const [peopleCount, setPeopleCount] = useState<number>(1);
  const [customerName, setCustomerName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [overrideArea, setOverrideArea] = useState(false);
  const [email, setEmail] = useState("");
  const [note, setNote] = useState("Đơn Facebook: ");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [createdOrder, setCreatedOrder] = useState<{
    orderId: string;
    publicCode: string;
  } | null>(null);

  const fetchDishes = async () => {
    setLoadingDishes(true);
    setDishesError("");
    try {
      const res = await fetch("/api/menu/today", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? "Không thể tải danh sách món ăn.");
      }
      const list: MenuDish[] = Array.isArray(data.dishes) ? data.dishes : [];
      setDishes(list);
      setSelected((prev) => {
        const next: Record<string, DishSelection> = {};
        for (const d of list) {
          next[d.id] = prev[d.id] ?? {
            included: false,
            grams: d.min_g ?? 200,
          };
        }
        return next;
      });
    } catch (err) {
      setDishesError(
        err instanceof Error ? err.message : "Lỗi tải thực đơn hôm nay."
      );
    } finally {
      setLoadingDishes(false);
    }
  };

  useEffect(() => {
    void fetchDishes();
  }, []);

  const addressCheck = useMemo(() => validateServiceArea(address), [address]);

  const safePeople = useMemo(() => {
    if (!Number.isFinite(peopleCount)) return 1;
    return Math.min(10, Math.max(1, Math.round(peopleCount)));
  }, [peopleCount]);

  const selectedLines = useMemo(() => {
    return dishes
      .filter((dish) => selected[dish.id]?.included)
      .map((dish) => {
        const gramsPerPerson = selected[dish.id]?.grams ?? dish.min_g ?? 200;
        const totalGrams = gramsPerPerson * safePeople;
        const itemPrice =
          totalGrams > 0 && dish.yield_g > 0
            ? Math.round((dish.price_vnd / dish.yield_g) * totalGrams)
            : 0;
        const nutrition =
          totalGrams >= 0
            ? calcPortion(dish.nutrition_per100, totalGrams)
            : { kcal: 0, protein: 0, carbs: 0, fat: 0 };
        return {
          dish,
          gramsPerPerson,
          totalGrams,
          itemPrice,
          nutrition,
        };
      });
  }, [dishes, selected, safePeople]);

  const totals = useMemo(() => {
    const subtotal = selectedLines.reduce((sum, l) => sum + l.itemPrice, 0);
    const shippingFee =
      selectedLines.length > 0 ? DELIVERY_CONFIG.shippingFeeVnd : 0;
    const nutrition = selectedLines.reduce(
      (acc, l) => ({
        kcal: acc.kcal + l.nutrition.kcal,
        protein: acc.protein + l.nutrition.protein,
        carbs: acc.carbs + l.nutrition.carbs,
        fat: acc.fat + l.nutrition.fat,
      }),
      { kcal: 0, protein: 0, carbs: 0, fat: 0 }
    );
    return {
      subtotal,
      shippingFee,
      total: subtotal + shippingFee,
      nutrition,
    };
  }, [selectedLines]);

  const toggleDish = (dish: MenuDish) => {
    setSelected((prev) => {
      const current = prev[dish.id] ?? {
        included: false,
        grams: dish.min_g ?? 200,
      };
      return {
        ...prev,
        [dish.id]: { ...current, included: !current.included },
      };
    });
  };

  const updateDishGrams = (dish: MenuDish, rawValue: string) => {
    const parsed = Number(rawValue);
    setSelected((prev) => {
      const current = prev[dish.id] ?? {
        included: true,
        grams: dish.min_g ?? 200,
      };
      return {
        ...prev,
        [dish.id]: {
          ...current,
          grams: Number.isFinite(parsed) ? parsed : 0,
        },
      };
    });
  };

  const resetForm = () => {
    setCustomerName("");
    setPhone("");
    setAddress("");
    setOverrideArea(false);
    setEmail("");
    setNote("Đơn Facebook: ");
    setPeopleCount(1);
    setError("");
    setCreatedOrder(null);
    setSelected((prev) => {
      const next: Record<string, DishSelection> = {};
      for (const d of dishes) {
        next[d.id] = {
          included: false,
          grams: prev[d.id]?.grams || d.min_g || 200,
        };
      }
      return next;
    });
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");

    if (!customerName.trim()) {
      setError("Vui lòng nhập họ tên khách hàng.");
      return;
    }
    if (!phone.trim()) {
      setError("Vui lòng nhập số điện thoại.");
      return;
    }
    if (!address.trim()) {
      setError("Vui lòng nhập địa chỉ giao hàng.");
      return;
    }
    if (!addressCheck.inService && !overrideArea) {
      setError(
        'Địa chỉ ngoài vùng phục vụ. Vui lòng tích "Tôi xác nhận địa chỉ ngoài vùng (nội bộ)" hoặc cập nhật địa chỉ.'
      );
      return;
    }
    if (selectedLines.length === 0) {
      setError("Vui lòng chọn ít nhất 1 món ăn.");
      return;
    }
    if (selectedLines.some((l) => !Number.isFinite(l.totalGrams) || l.totalGrams <= 0)) {
      setError("Định lượng gram mỗi món phải lớn hơn 0.");
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        customerName: customerName.trim(),
        phone: phone.trim(),
        address: address.trim(),
        email: email.trim() || undefined,
        note: note.trim() || "Đơn Facebook: ",
        source: "facebook",
        overrideArea: !addressCheck.inService && overrideArea,
        people: safePeople,
        lines: selectedLines.map((l) => ({
          dishId: l.dish.id,
          grams: l.totalGrams,
        })),
      };

      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Không thể tạo đơn hàng.");
        return;
      }

      setCreatedOrder({
        orderId: data.orderId,
        publicCode: data.publicCode,
      });
      router.refresh();
    } catch {
      setError("Lỗi kết nối máy chủ khi tạo đơn.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {createdOrder && (
        <div
          role="status"
          className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-emerald-950 shadow-sm"
        >
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm font-black text-emerald-800">
                ✓ Tạo đơn Facebook thành công!
              </p>
              <p className="mt-1 text-sm">
                Mã đơn:{" "}
                <strong className="font-mono text-brand-950">
                  #{createdOrder.publicCode}
                </strong>{" "}
                · ID:{" "}
                <span className="font-mono text-xs text-slate-600">
                  {createdOrder.orderId}
                </span>
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link
                href={`/admin/orders/${createdOrder.orderId}`}
                className="rounded-xl bg-brand-700 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-brand-950"
              >
                Mở chi tiết đơn →
              </Link>
              <button
                type="button"
                onClick={resetForm}
                className="rounded-xl bg-white px-4 py-2 text-xs font-bold text-brand-700 shadow-sm ring-1 ring-emerald-200 hover:bg-emerald-100"
              >
                + Nhập đơn tiếp theo
              </button>
            </div>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <section className="space-y-4 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-100">
          <h2 className="text-lg font-bold text-brand-950">
            Thông tin khách hàng (Facebook)
          </h2>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-bold text-slate-700">
                Tên khách hàng <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="VD: Nguyễn Minh Anh"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-brand-700"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700">
                Số điện thoại <span className="text-rose-500">*</span>
              </label>
              <input
                type="tel"
                required
                placeholder="VD: 0909123456"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-brand-700"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-slate-700">
                Địa chỉ giao hàng <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="VD: 123 Lê Lợi, Phường Bến Nghé, Quận 1"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-brand-700"
              />

              {address.trim().length > 0 && (
                <div className="mt-2">
                  {addressCheck.inService ? (
                    <p className="text-xs font-bold text-emerald-700">
                      ✓ Trong vùng phục vụ: {addressCheck.matchedDistrict}
                    </p>
                  ) : (
                    <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                      <p className="font-bold">
                        ⚠ Cảnh báo ngoài vùng phục vụ
                      </p>
                      <p className="mt-0.5">{addressCheck.message}</p>
                      <label className="mt-2 flex cursor-pointer items-center gap-2 font-semibold text-amber-950">
                        <input
                          type="checkbox"
                          checked={overrideArea}
                          onChange={(e) => setOverrideArea(e.target.checked)}
                          className="h-4 w-4 rounded border-amber-400 text-orange-500"
                        />
                        Tôi xác nhận địa chỉ ngoài vùng (nội bộ)
                      </label>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700">
                Email (tùy chọn)
              </label>
              <input
                type="email"
                placeholder="khachhang@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-brand-700"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700">
                Số người ăn (1–10) <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                min={1}
                max={10}
                required
                value={peopleCount}
                onChange={(e) => setPeopleCount(Number(e.target.value) || 1)}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-brand-700"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-slate-700">
                Ghi chú đơn hàng
              </label>
              <input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Đơn Facebook: ghi chú khách dặn..."
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-brand-700"
              />
            </div>
          </div>
        </section>

        <section className="space-y-4 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-100">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-bold text-brand-950">
              Chọn món & định lượng (g/người)
            </h2>
            <span className="text-xs font-semibold text-slate-500">
              Nhân tự động × {safePeople} người
            </span>
          </div>

          {loadingDishes ? (
            <p className="py-4 text-sm text-slate-500">
              Đang tải danh sách món ăn…
            </p>
          ) : dishesError ? (
            <div className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">
              <p>{dishesError}</p>
              <button
                type="button"
                onClick={() => void fetchDishes()}
                className="mt-2 text-xs font-bold underline"
              >
                Thử tải lại
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {dishes.map((dish) => {
                const state = selected[dish.id] ?? {
                  included: false,
                  grams: dish.min_g ?? 200,
                };
                const totalGrams = state.grams * safePeople;
                const linePrice =
                  totalGrams > 0 && dish.yield_g > 0
                    ? Math.round((dish.price_vnd / dish.yield_g) * totalGrams)
                    : 0;

                return (
                  <div
                    key={dish.id}
                    className={`flex flex-wrap items-center justify-between gap-4 rounded-xl border p-3.5 transition ${
                      state.included
                        ? "border-brand-700 bg-brand-50/40"
                        : "border-slate-200 bg-white"
                    }`}
                  >
                    <label className="flex flex-1 cursor-pointer items-center gap-3">
                      <input
                        type="checkbox"
                        checked={state.included}
                        onChange={() => toggleDish(dish)}
                        className="h-4 w-4 rounded border-slate-300 text-brand-700"
                      />
                      <div>
                        <p className="text-sm font-bold text-brand-950">
                          {dish.image_url && !dish.image_url.startsWith("http")
                            ? `${dish.image_url} `
                            : ""}
                          {dish.name}
                        </p>
                        <p className="text-xs text-slate-500">
                          {formatVnd(dish.price_vnd)} / {dish.yield_g}g chuẩn ·{" "}
                          {Math.round(dish.nutrition_per100.kcal)} kcal/100g
                        </p>
                      </div>
                    </label>

                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1.5">
                        <input
                          type="number"
                          min={1}
                          step={dish.step_g ?? 50}
                          disabled={!state.included}
                          aria-label={`Gram mỗi người cho ${dish.name}`}
                          value={state.grams}
                          onChange={(e) =>
                            updateDishGrams(dish, e.target.value)
                          }
                          className="w-24 rounded-lg border border-slate-200 px-2.5 py-1.5 text-right text-sm font-semibold disabled:bg-slate-100 disabled:text-slate-400"
                        />
                        <span className="text-xs text-slate-500">g/người</span>
                      </div>

                      {state.included && (
                        <div className="min-w-24 text-right">
                          <p className="text-xs font-bold text-brand-700">
                            {formatVnd(linePrice)}
                          </p>
                          <p className="text-[11px] text-slate-500">
                            Tổng {totalGrams}g
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section className="rounded-2xl bg-brand-950 p-5 text-white shadow-sm">
          <h2 className="text-sm font-bold uppercase tracking-wide text-brand-100">
            Tạm tính đơn Facebook ({selectedLines.length} món · {safePeople} người)
          </h2>

          <div className="mt-3 space-y-1.5 text-sm">
            <div className="flex justify-between text-brand-100">
              <span>Tiền món ăn</span>
              <span>{formatVnd(totals.subtotal)}</span>
            </div>
            <div className="flex justify-between text-brand-100">
              <span>Phí giao hàng</span>
              <span>{formatVnd(totals.shippingFee)}</span>
            </div>
            <div className="flex justify-between border-t border-brand-700 pt-2 text-base font-black">
              <span>Tổng cộng</span>
              <span className="text-orange-400">{formatVnd(totals.total)}</span>
            </div>
          </div>

          <p className="mt-2 text-xs text-brand-100">
            Dinh dưỡng ước tính: {Math.round(totals.nutrition.kcal)} kcal · P{" "}
            {Math.round(totals.nutrition.protein)}g · C{" "}
            {Math.round(totals.nutrition.carbs)}g · F{" "}
            {Math.round(totals.nutrition.fat)}g
          </p>
        </section>

        {error && (
          <p
            role="alert"
            className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-medium text-rose-700"
          >
            {error}
          </p>
        )}

        <div className="flex flex-wrap items-center justify-end gap-3">
          <Link
            href="/admin"
            className="rounded-xl bg-white px-4 py-2.5 text-sm font-bold text-slate-700 shadow-sm hover:bg-slate-50"
          >
            Hủy
          </Link>
          <button
            type="submit"
            disabled={submitting || loadingDishes}
            className="rounded-xl bg-orange-500 px-6 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-orange-600 disabled:opacity-50"
          >
            {submitting ? "Đang tạo đơn Facebook…" : "Tạo đơn Facebook"}
          </button>
        </div>
      </form>
    </div>
  );
}
