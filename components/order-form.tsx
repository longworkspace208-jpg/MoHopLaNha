"use client";
import { useMemo, useState } from "react";
import { menu } from "@/lib/menu";
import { formatVnd } from "@/lib/format";
import type { CartLine } from "@/lib/types";

const initialCart: CartLine[] = [{ dishId: menu[0].id, quantity: 1 }];
export function OrderForm() {
  const [cart, setCart] = useState<CartLine[]>(initialCart);
  const [form, setForm] = useState({ customerName: "", phone: "", address: "", note: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [publicCode, setPublicCode] = useState("");
  const calculation = useMemo(() => cart.reduce((sum, line) => sum + (menu.find((d) => d.id === line.dishId)?.price ?? 0) * line.quantity, 0), [cart]);
  const changeQuantity = (dishId: string, quantity: number) => setCart((old) => old.map((item) => item.dishId === dishId ? { ...item, quantity: Math.max(1, quantity) } : item));
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setLoading(true); setError("");
    try {
      const response = await fetch("/api/orders", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, items: cart }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Không thể tạo đơn.");
      setPublicCode(result.publicCode);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Có lỗi xảy ra."); }
    finally { setLoading(false); }
  }
  if (publicCode) return <section className="rounded-3xl bg-white p-6 text-center shadow-sm"><div className="text-4xl">🎉</div><h2 className="mt-3 text-xl font-bold">Đã tạo đơn hàng</h2><p className="mt-2 text-sm text-slate-600">Quét QR để xem thông tin thanh toán. Trạng thái chỉ đổi sau khi quản trị viên xác nhận.</p><a className="mt-5 inline-block rounded-full bg-brand-700 px-5 py-3 font-bold text-white" href={`/n/${publicCode}`}>Mở mã thanh toán</a></section>;
  return <form onSubmit={submit} className="space-y-5">
    <section className="space-y-3"><h2 className="text-xl font-bold">Chọn hộp cơm</h2>{menu.map((dish) => { const line = cart.find((item) => item.dishId === dish.id); return <article key={dish.id} className="rounded-3xl border border-emerald-100 bg-white p-4 shadow-sm"><div className="flex gap-3"><div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-amber-50 text-2xl">{dish.image}</div><div className="min-w-0 flex-1"><h3 className="font-bold">{dish.name}</h3><p className="mt-1 text-sm text-slate-600">{dish.description}</p><p className="mt-2 text-sm font-semibold text-emerald-700">{formatVnd(dish.price)} · {dish.nutrition.kcal} kcal</p></div></div><div className="mt-3 flex items-center justify-between">{line ? <div className="flex items-center gap-3"><button aria-label={`Giảm ${dish.name}`} type="button" onClick={() => changeQuantity(dish.id, line.quantity - 1)} className="grid h-9 w-9 place-items-center rounded-full border font-bold">−</button><span className="w-4 text-center font-bold">{line.quantity}</span><button aria-label={`Tăng ${dish.name}`} type="button" onClick={() => changeQuantity(dish.id, line.quantity + 1)} className="grid h-9 w-9 place-items-center rounded-full border font-bold">+</button></div> : <button type="button" onClick={() => setCart([...cart, { dishId: dish.id, quantity: 1 }])} className="rounded-full border border-emerald-700 px-4 py-2 text-sm font-bold text-emerald-700">Thêm món</button>} {line && <button type="button" onClick={() => setCart(cart.filter((item) => item.dishId !== dish.id))} className="text-sm text-slate-500">Bỏ món</button>}</div></article>; })}</section>
    <section className="rounded-3xl bg-emerald-950 p-5 text-white"><div className="flex justify-between"><span>Tạm tính</span><strong>{formatVnd(calculation)}</strong></div><p className="mt-2 text-xs text-emerald-100">Giá và dinh dưỡng sẽ được máy chủ tính lại từ dữ liệu món ăn.</p></section>
    <section className="space-y-3 rounded-3xl bg-white p-4 shadow-sm"><h2 className="text-xl font-bold">Giao đến nhà bạn</h2>{([['customerName','Họ và tên'],['phone','Số điện thoại'],['address','Địa chỉ nhận cơm']] as const).map(([key,label]) => <label key={key} className="block text-sm font-medium">{label}<input required value={form[key]} onChange={(e) => setForm({...form,[key]:e.target.value})} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-3 outline-emerald-600" /></label>)}<label className="block text-sm font-medium">Ghi chú (không bắt buộc)<textarea value={form.note} onChange={(e) => setForm({...form,note:e.target.value})} className="mt-1 min-h-20 w-full rounded-xl border border-slate-200 px-3 py-3 outline-emerald-600" /></label></section>
    {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}<button disabled={loading || !cart.length} className="w-full rounded-full bg-orange-500 px-5 py-4 font-bold text-white disabled:opacity-60">{loading ? "Đang tạo đơn..." : "Đặt cơm & nhận QR"}</button>
  </form>;
}
