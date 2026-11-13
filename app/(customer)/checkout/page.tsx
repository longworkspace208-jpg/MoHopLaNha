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

  const subtotal = useMemo(() => {
    return lines.reduce((sum, line) => {
      const totalGrams = line.gramsPerPerson * people;
      const price = (line.dish.price_vnd / line.dish.yield_g) * totalGrams;
      return sum + price;
    }, 0);
  }, [lines, people]);

  const shippingFee = lines.length > 0 ? DELIVERY_CONFIG.shippingFeeVnd : 0;
  const total = subtotal + shippingFee;

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
          grams: line.gramsPerPerson * people,
        })),
      };

      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? "Không thể tạo đơn hàng. Vui lòng thử lại.");
      }

      clearCart();
      router.push(`/payment/${data.publicToken}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Có lỗi xảy ra.");
      setSubmitting(false);
    }
  }

  if (!mounted) {
    return (
      <main className="mx-auto min-h-screen max-w-6xl px-4 py-16 sm:px-6 lg:px-10">
        <p className="font-mono text-xs font-semibold uppercase tracking-[0.16em] text-muted">
          Đang chuẩn bị trang thanh toán…
        </p>
      </main>
    );
  }

  if (lines.length === 0) {
    return (
      <main className="mx-auto min-h-screen max-w-2xl px-4 py-16 sm:px-6">
        <div className="border border-rule bg-white p-8 text-center shadow-sm sm:p-12">
          <p className="font-mono text-[11px] font-bold uppercase tracking-[0.2em] text-coral">
            Khay cơm đang trống
          </p>
          <h1 className="mt-3 font-display text-3xl font-semibold text-forest">
            Giỏ hàng đang trống
          </h1>
          <p className="mt-2 text-sm text-muted">
            Vui lòng chọn món trước khi tiến hành thanh toán.
          </p>
          <Link
            href="/menu"
            className="mt-6 inline-block bg-coral px-6 py-3.5 font-mono text-xs font-bold uppercase tracking-[0.16em] text-white shadow-sm transition-all hover:bg-coral-hover hover:shadow-md"
          >
            Quay lại thực đơn
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto min-h-screen max-w-6xl px-4 pb-20 pt-8 sm:px-6 lg:px-10">
      <header className="flex flex-col justify-between gap-4 border-b-2 border-forest pb-5 sm:flex-row sm:items-end">
        <div>
          <p className="font-mono text-[11px] font-bold uppercase tracking-[0.2em] text-coral">
            Bước cuối cùng · Nhận mã VietQR chuẩn Napas 247
          </p>
          <h1 className="mt-1 font-display text-4xl font-semibold tracking-[-0.02em] text-forest">
            Thông tin giao hàng
          </h1>
        </div>
        <Link
          href="/cart"
          className="border-b-2 border-forest pb-0.5 font-mono text-xs font-bold uppercase tracking-[0.14em] text-forest transition-colors hover:border-coral hover:text-coral"
        >
          ← Sửa giỏ hàng
        </Link>
      </header>

      <form
        onSubmit={handleSubmit}
        className="mt-8 grid gap-10 lg:grid-cols-12 lg:items-start"
      >
        {/* Cột trái: Form thông tin người nhận */}
        <section className="space-y-6 border border-rule bg-white p-6 shadow-sm sm:p-8 lg:col-span-7">
          <div className="border-b border-rule pb-3">
            <h2 className="font-display text-2xl font-semibold text-forest">
              Người nhận cơm
            </h2>
          </div>

          <div>
            <label className="block font-mono text-xs font-bold uppercase tracking-[0.14em] text-forest">
              Họ và tên <span className="text-coral">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="Ví dụ: Nguyễn Văn An"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              className="mt-2 w-full border border-rule bg-ivory/30 px-3.5 py-3 text-sm text-ink outline-none transition-colors focus:border-forest focus:bg-white"
            />
          </div>

          <div>
            <label className="block font-mono text-xs font-bold uppercase tracking-[0.14em] text-forest">
              Số điện thoại <span className="text-coral">*</span>
            </label>
            <input
              type="tel"
              required
              placeholder="Ví dụ: 0912345678"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className={`mt-2 w-full border bg-ivory/30 px-3.5 py-3 text-sm text-ink outline-none transition-colors focus:bg-white ${
                phone && !isPhoneValid
                  ? "border-red-600 focus:border-red-700"
                  : "border-rule focus:border-forest"
              }`}
            />
            {phone && !isPhoneValid && (
              <p className="mt-1.5 text-xs font-medium text-red-600">
                Vui lòng nhập số điện thoại Việt Nam hợp lệ (10 chữ số, bắt đầu bằng 0).
              </p>
            )}
          </div>

          <div>
            <div className="flex items-center justify-between">
              <label className="block font-mono text-xs font-bold uppercase tracking-[0.14em] text-forest">
                Email
              </label>
              <span className="font-mono text-[10px] font-medium uppercase tracking-[0.12em] text-muted">
                Không bắt buộc
              </span>
            </div>
            <input
              type="email"
              placeholder="Để nhận thông báo xác nhận đơn hàng"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-2 w-full border border-rule bg-ivory/30 px-3.5 py-3 text-sm text-ink outline-none transition-colors focus:border-forest focus:bg-white"
            />
          </div>

          <div>
            <label className="block font-mono text-xs font-bold uppercase tracking-[0.14em] text-forest">
              Địa chỉ nhận hàng (kèm Quận/Huyện){" "}
              <span className="text-coral">*</span>
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
              className={`mt-2 w-full border bg-ivory/30 px-3.5 py-3 text-sm text-ink outline-none transition-colors focus:bg-white ${
                touchedAddress && address && !addressValidation.inService
                  ? "border-red-600 focus:border-red-700"
                  : addressValidation.inService
                    ? "border-forest focus:border-forest"
                    : "border-rule focus:border-forest"
              }`}
            />

            {address.trim().length > 0 && (
              <div className="mt-2.5">
                {addressValidation.inService ? (
                  <p className="border-l-4 border-forest bg-forest/5 px-3 py-2 text-xs font-semibold text-forest">
                    ✓ Địa chỉ thuộc vùng giao hàng: {addressValidation.matchedDistrict}
                  </p>
                ) : (
                  <div
                    role="alert"
                    className="border-l-4 border-red-600 bg-red-50/60 px-3.5 py-2.5 text-xs text-red-800"
                  >
                    <p className="font-bold">Không thể giao hàng đến địa chỉ này</p>
                    <p className="mt-1">{addressValidation.message}</p>
                  </div>
                )}
              </div>
            )}
            {!address && (
              <p className="mt-1.5 text-[11px] text-muted">
                Vùng hỗ trợ giao hàng:{" "}
                {DELIVERY_CONFIG.serviceDistricts
                  .map((d) => d.district)
                  .join(", ")}
                .
              </p>
            )}
          </div>

          <div>
            <label className="block font-mono text-xs font-bold uppercase tracking-[0.14em] text-forest">
              Ghi chú cho bếp hoặc shipper (không bắt buộc)
            </label>
            <input
              type="text"
              placeholder="Ví dụ: Để ở bàn lễ tân, canh ít cay..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="mt-2 w-full border border-rule bg-ivory/30 px-3.5 py-3 text-sm text-ink outline-none transition-colors focus:border-forest focus:bg-white"
            />
          </div>
        </section>

        {/* Cột phải: Sticky Tóm tắt đơn & Nút đặt hàng Deep Forest Green */}
        <aside className="space-y-5 lg:sticky lg:top-24 lg:col-span-5">
          <section className="bg-forest p-6 text-white shadow-sm">
            <h2 className="border-b border-white/20 pb-3 font-display text-xl font-semibold text-white">
              Món đã chọn ({lines.length} món)
            </h2>

            <div className="divide-y divide-white/10">
              {lines.map((line) => {
                const itemGrams = line.gramsPerPerson * people;
                const itemPrice = Math.round(
                  (line.dish.price_vnd / line.dish.yield_g) * itemGrams
                );
                return (
                  <div
                    key={line.dish.id}
                    className="flex items-baseline justify-between gap-3 py-3 text-xs"
                  >
                    <div>
                      <span className="font-medium text-white">
                        {line.dish.name}
                      </span>
                      <span className="ml-2 font-mono text-ivory/70">
                        ({itemGrams}g)
                      </span>
                    </div>
                    <span className="shrink-0 font-mono font-bold tabular-nums text-ivory">
                      {formatVnd(itemPrice)}
                    </span>
                  </div>
                );
              })}
            </div>

            <div className="mt-2 space-y-2.5 border-t border-white/15 pt-4 text-sm text-ivory/80">
              <div className="flex justify-between">
                <span>Tạm tính ({people} người)</span>
                <span className="font-mono font-bold tabular-nums text-white">
                  {formatVnd(Math.round(subtotal))}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Phí vận chuyển (nội thành)</span>
                <span className="font-mono font-bold tabular-nums text-white">
                  {formatVnd(shippingFee)}
                </span>
              </div>
              <div className="flex items-baseline justify-between border-t border-white/20 pt-3">
                <span className="font-display text-lg font-semibold text-white">
                  Tổng thanh toán
                </span>
                <span className="font-display text-3xl font-bold text-coral">
                  {formatVnd(Math.round(total))}
                </span>
              </div>
            </div>

            {error && (
              <div
                role="alert"
                className="mt-4 border-l-4 border-coral bg-white p-3.5 text-xs font-medium text-ink"
              >
                <p className="font-bold text-red-600">Không thể đặt đơn</p>
                <p className="mt-1">{error}</p>
                <Link
                  href="/menu"
                  className="mt-2 inline-block font-mono text-[11px] font-bold uppercase tracking-[0.12em] text-forest underline hover:text-coral"
                >
                  ← Quay lại thực đơn để điều chỉnh món
                </Link>
              </div>
            )}

            <button
              type="submit"
              disabled={!isFormValid || submitting}
              className="mt-6 flex w-full items-center justify-center gap-2 bg-coral py-4 text-center font-mono text-xs font-bold uppercase tracking-[0.16em] text-white shadow-md transition-all hover:bg-coral-hover hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <span>
                {submitting
                  ? "Đang khởi tạo đơn hàng…"
                  : !addressValidation.inService && address.length > 0
                    ? "Địa chỉ ngoài vùng — Không thể đặt"
                    : `Đặt cơm & Nhận mã VietQR · ${formatVnd(Math.round(total))}`}
              </span>
              {!submitting && isFormValid && <span aria-hidden="true">→</span>}
            </button>

            {!addressValidation.inService && address.length > 0 && (
              <p className="mt-2 text-center text-xs text-coral">
                Vui lòng đổi địa chỉ nhận hàng thuộc vùng phục vụ để tiếp tục.
              </p>
            )}
          </section>
        </aside>
      </form>
    </main>
  );
}
