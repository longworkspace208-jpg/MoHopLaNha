"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCartStore } from "@/lib/cart-store";
import { formatVnd } from "@/lib/format";
import { DELIVERY_CONFIG, validateServiceArea } from "@/lib/delivery-config";

export default function CheckoutPage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  const people = useCartStore((state) => state.people);
  const lines = useCartStore((state) => state.lines);
  const clearCart = useCartStore((state) => state.clearCart);

  const [customerName, setCustomerName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [email, setEmail] = useState("");
  const [note, setNote] = useState("");

  const [touchedAddress, setTouchedAddress] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setMounted(true);
  }, []);

  // Tính toán tài chính
  const subtotal = useMemo(() => {
    return lines.reduce((sum, line) => {
      const totalGrams = line.gramsPerPerson * people;
      const price = (line.dish.price_vnd / line.dish.yield_g) * totalGrams;
      return sum + price;
    }, 0);
  }, [lines, people]);

  const shippingFee = lines.length > 0 ? DELIVERY_CONFIG.shippingFeeVnd : 0;
  const total = subtotal + shippingFee;

  // Kiểm tra địa chỉ thuộc vùng phục vụ
  const addressValidation = useMemo(() => {
    return validateServiceArea(address);
  }, [address]);

  const isPhoneValid = useMemo(() => {
    const cleaned = phone.trim().replace(/[\s.-]/g, "");
    return /^0\d{9,10}$/.test(cleaned);
  }, [phone]);

  const isFormValid =
    customerName.trim().length >= 2 &&
    isPhoneValid &&
    address.trim().length >= 5 &&
    addressValidation.inService &&
    lines.length > 0;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isFormValid || submitting) return;

    setSubmitting(true);
    setError("");

    try {
      const payload = {
        customerName: customerName.trim(),
        phone: phone.trim(),
        address: address.trim(),
        email: email.trim() || undefined,
        note: note.trim() || undefined,
        lines: lines.map((line) => ({
          dishId: line.dish.id,
          grams: line.gramsPerPerson * people
        }))
      };

      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? "Không thể tạo đơn hàng. Vui lòng thử lại.");
      }

      // Xóa giỏ hàng và chuyển hướng sang trang thanh toán /payment/[orderId]
      clearCart();
      router.push(`/payment/${data.orderId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Có lỗi xảy ra.");
      setSubmitting(false);
    }
  }

  if (!mounted) {
    return (
      <main className="mx-auto min-h-screen max-w-lg px-4 py-8">
        <p className="text-center text-sm text-slate-500">Đang chuẩn bị trang thanh toán…</p>
      </main>
    );
  }

  if (lines.length === 0) {
    return (
      <main className="mx-auto min-h-screen max-w-lg px-4 py-12">
        <div className="rounded-3xl bg-white p-8 text-center shadow-sm">
          <div className="text-4xl">🛒</div>
          <h1 className="mt-3 text-xl font-bold text-brand-950">Giỏ hàng đang trống</h1>
          <p className="mt-2 text-sm text-slate-600">
            Vui lòng chọn món trước khi tiến hành thanh toán.
          </p>
          <Link
            href="/menu"
            className="mt-5 inline-block rounded-full bg-orange-500 px-6 py-3 text-sm font-bold text-white shadow-md hover:bg-orange-600"
          >
            Quay lại thực đơn
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto min-h-screen max-w-lg px-4 pb-16 pt-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-black text-brand-950">Thông tin giao hàng</h1>
        <Link href="/cart" className="text-xs font-bold text-brand-700 underline">
          ← Sửa giỏ hàng
        </Link>
      </div>

      <form onSubmit={handleSubmit} className="mt-6 space-y-5">
        {/* Thông tin khách hàng */}
        <section className="space-y-4 rounded-3xl bg-white p-5 shadow-sm">
          <h2 className="text-base font-bold text-brand-950">Người nhận cơm</h2>

          {/* Họ và tên */}
          <div>
            <label className="block text-xs font-bold text-slate-700">
              Họ và tên <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="Ví dụ: Nguyễn Văn An"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              className="mt-1.5 w-full rounded-xl border border-slate-200 px-3.5 py-3 text-sm outline-none transition focus:border-brand-600 focus:ring-2 focus:ring-brand-100"
            />
          </div>

          {/* Số điện thoại */}
          <div>
            <label className="block text-xs font-bold text-slate-700">
              Số điện thoại <span className="text-red-500">*</span>
            </label>
            <input
              type="tel"
              required
              placeholder="Ví dụ: 0912345678"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className={`mt-1.5 w-full rounded-xl border px-3.5 py-3 text-sm outline-none transition focus:ring-2 ${
                phone && !isPhoneValid
                  ? "border-red-300 focus:border-red-500 focus:ring-red-100"
                  : "border-slate-200 focus:border-brand-600 focus:ring-brand-100"
              }`}
            />
            {phone && !isPhoneValid && (
              <p className="mt-1 text-xs text-red-600">
                Vui lòng nhập số điện thoại Việt Nam hợp lệ (10 chữ số, bắt đầu bằng 0).
              </p>
            )}
          </div>

          {/* Email (không bắt buộc) */}
          <div>
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold text-slate-700">Email</label>
              <span className="text-[11px] text-slate-400">Không bắt buộc</span>
            </div>
            <input
              type="email"
              placeholder="Để nhận thông báo xác nhận đơn hàng"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1.5 w-full rounded-xl border border-slate-200 px-3.5 py-3 text-sm outline-none transition focus:border-brand-600 focus:ring-2 focus:ring-brand-100"
            />
          </div>

          {/* Địa chỉ nhận hàng */}
          <div>
            <label className="block text-xs font-bold text-slate-700">
              Địa chỉ nhận hàng (kèm Quận/Huyện) <span className="text-red-500">*</span>
            </label>
            <textarea
              required
              rows={2}
              placeholder="Ví dụ: 123 Lê Lợi, Phường Bến Nghé, Quận 1"
              value={address}
              onChange={(e) => {
                setAddress(e.target.value);
                setTouchedAddress(true);
              }}
              className={`mt-1.5 w-full rounded-xl border px-3.5 py-3 text-sm outline-none transition focus:ring-2 ${
                touchedAddress && address && !addressValidation.inService
                  ? "border-red-400 bg-red-50/30 focus:border-red-500 focus:ring-red-100"
                  : addressValidation.inService
                  ? "border-emerald-400 bg-emerald-50/20 focus:border-emerald-600 focus:ring-emerald-100"
                  : "border-slate-200 focus:border-brand-600 focus:ring-brand-100"
              }`}
            />

            {/* Thông báo kiểm tra vùng phục vụ */}
            {address.trim().length > 0 && (
              <div className="mt-2">
                {addressValidation.inService ? (
                  <p className="flex items-center gap-1.5 text-xs font-bold text-emerald-700">
                    <span>✓</span> Địa chỉ thuộc vùng giao hàng: {addressValidation.matchedDistrict}
                  </p>
                ) : (
                  <div
                    role="alert"
                    className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700"
                  >
                    <p className="font-bold">⚠️ Không thể giao hàng đến địa chỉ này</p>
                    <p className="mt-1">{addressValidation.message}</p>
                  </div>
                )}
              </div>
            )}
            {!address && (
              <p className="mt-1 text-[11px] text-slate-500">
                Vùng hỗ trợ:{" "}
                {DELIVERY_CONFIG.serviceDistricts.map((d) => d.district).join(", ")}.
              </p>
            )}
          </div>

          {/* Ghi chú */}
          <div>
            <label className="block text-xs font-bold text-slate-700">
              Ghi chú cho bếp hoặc shipper (không bắt buộc)
            </label>
            <input
              type="text"
              placeholder="Ví dụ: Để ở bàn bảo vệ, không cay..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="mt-1.5 w-full rounded-xl border border-slate-200 px-3.5 py-3 text-sm outline-none transition focus:border-brand-600 focus:ring-2 focus:ring-brand-100"
            />
          </div>
        </section>

        {/* Tóm tắt đơn hàng */}
        <section className="space-y-3 rounded-3xl bg-white p-5 shadow-sm">
          <h2 className="text-base font-bold text-brand-950">Món đã chọn ({lines.length} món)</h2>
          <div className="divide-y divide-slate-100">
            {lines.map((line) => {
              const itemGrams = line.gramsPerPerson * people;
              const itemPrice = Math.round((line.dish.price_vnd / line.dish.yield_g) * itemGrams);
              return (
                <div key={line.dish.id} className="flex justify-between py-2 text-xs">
                  <div>
                    <span className="font-bold text-slate-800">{line.dish.name}</span>
                    <span className="ml-2 text-slate-500">({itemGrams}g)</span>
                  </div>
                  <span className="font-bold text-brand-700">{formatVnd(itemPrice)}</span>
                </div>
              );
            })}
          </div>

          <div className="border-t border-slate-100 pt-3 space-y-2 text-sm text-slate-600">
            <div className="flex justify-between">
              <span>Tạm tính ({people} người)</span>
              <span className="font-semibold">{formatVnd(Math.round(subtotal))}</span>
            </div>
            <div className="flex justify-between">
              <span>Phí vận chuyển (từ config)</span>
              <span className="font-semibold">{formatVnd(shippingFee)}</span>
            </div>
            <div className="flex justify-between border-t border-slate-100 pt-2 text-base font-black text-brand-950">
              <span>Tổng thanh toán</span>
              <span className="text-xl text-orange-600">{formatVnd(Math.round(total))}</span>
            </div>
          </div>
        </section>

        {/* Hiển thị lỗi nếu có */}
        {error && (
          <div
            role="alert"
            className="rounded-2xl border border-red-200 bg-red-50 p-4 text-xs font-medium text-red-700"
          >
            <p className="font-bold">⚠️ Không thể đặt đơn</p>
            <p className="mt-1">{error}</p>
            <Link
              href="/menu"
              className="mt-2 inline-block font-bold text-red-800 underline"
            >
              ← Quay lại thực đơn để điều chỉnh món
            </Link>
          </div>
        )}

        {/* Nút đặt hàng: CHẶN nếu ngoài vùng phục vụ hoặc thiếu thông tin */}
        <div>
          <button
            type="submit"
            disabled={!isFormValid || submitting}
            className="w-full rounded-full bg-orange-500 py-4 font-black text-white shadow-lg transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none"
          >
            {submitting ? (
              "Đang khởi tạo đơn hàng…"
            ) : !addressValidation.inService && address.length > 0 ? (
              "Địa chỉ ngoài vùng phục vụ — Không thể đặt"
            ) : (
              `Đặt cơm & Nhận mã VietQR · ${formatVnd(Math.round(total))}`
            )}
          </button>
          {!addressValidation.inService && address.length > 0 && (
            <p className="mt-2 text-center text-xs text-red-600">
              Vui lòng đổi địa chỉ nhận hàng thuộc vùng phục vụ để tiếp tục.
            </p>
          )}
        </div>
      </form>
    </main>
  );
}

