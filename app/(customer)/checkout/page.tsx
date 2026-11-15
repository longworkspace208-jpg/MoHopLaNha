"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCartStore, sanitizeCartLine, type CartLine } from "@/lib/cart-store";
import { formatVnd } from "@/lib/format";
import { DELIVERY_CONFIG, validateServiceArea } from "@/lib/delivery-config";

export default function CheckoutPage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  const people = useCartStore((state) => state.people);
  const goal = useCartStore((state) => state.goal);
  const lines = useCartStore((state) => state.lines);
  const clearCart = useCartStore((state) => state.clearCart);

  const [customerName, setCustomerName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [email, setEmail] = useState("");
  const [note, setNote] = useState("");

  const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(null);
  const [predictions, setPredictions] = useState<
    Array<{ place_id: string; description: string; main_text: string; secondary_text: string }>
  >([]);
  const [showPredictions, setShowPredictions] = useState(false);
  const [activePredictionIndex, setActivePredictionIndex] = useState(-1);
  const [isSearchingAddress, setIsSearchingAddress] = useState(false);
  const [deliveryCheck, setDeliveryCheck] = useState<{
    deliverable: boolean;
    distance_m: number;
    duration_s: number;
    reason: string;
    approximate?: boolean;
  } | null>(null);
  const [checkingDelivery, setCheckingDelivery] = useState(false);

  const [touchedAddress, setTouchedAddress] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setMounted(true);
  }, []);

  // Gợi ý địa chỉ từ Goong Place AutoComplete & bộ dữ liệu Hà Nội (debounce 250ms, input >= 2 ký tự)
  useEffect(() => {
    const clean = address.trim();
    if (clean.length < 2 || selectedPlaceId) {
      setPredictions([]);
      setIsSearchingAddress(false);
      return;
    }

    setIsSearchingAddress(true);
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/delivery/autocomplete?input=${encodeURIComponent(clean)}`);
        if (res.ok) {
          const data = await res.json();
          setPredictions(data.predictions || []);
          setShowPredictions(true);
          setActivePredictionIndex(-1);
        }
      } catch {
        setPredictions([]);
      } finally {
        setIsSearchingAddress(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [address, selectedPlaceId]);

  async function verifyAddressDistance(params: { placeId?: string; address?: string }) {
    setCheckingDelivery(true);
    try {
      const res = await fetch("/api/delivery/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
      });
      if (res.ok) {
        const data = await res.json();
        setDeliveryCheck(data);
      }
    } catch {
      // Bỏ qua lỗi kết nối
    } finally {
      setCheckingDelivery(false);
    }
  }

  function handleSelectPrediction(p: { place_id: string; description: string }) {
    setAddress(p.description);
    setSelectedPlaceId(p.place_id);
    setShowPredictions(false);
    setPredictions([]);
    setActivePredictionIndex(-1);
    setTouchedAddress(true);
    verifyAddressDistance({ placeId: p.place_id, address: p.description });
  }

  const validLines = useMemo(() => {
    return lines
      .map((line) => sanitizeCartLine(line, people))
      .filter((line): line is CartLine => Boolean(line));
  }, [lines, people]);

  const subtotal = useMemo(() => {
    return validLines.reduce((sum, line) => {
      const yieldG = line.dish.yield_g > 0 ? line.dish.yield_g : 350;
      const price = (line.dish.price_vnd / yieldG) * line.grams;
      return sum + (Number.isFinite(price) ? price : 0);
    }, 0);
  }, [validLines]);

  const shippingFee = validLines.length > 0 ? DELIVERY_CONFIG.shippingFeeVnd : 0;
  const total = subtotal + shippingFee;

  const addressValidation = useMemo(() => {
    return validateServiceArea(address);
  }, [address]);

  const isAddressDeliverable = deliveryCheck
    ? deliveryCheck.deliverable
    : addressValidation.inService;

  const isPhoneValid = useMemo(() => {
    const cleaned = phone.trim().replace(/[\s.-]/g, "");
    return /^0\d{9,10}$/.test(cleaned);
  }, [phone]);

  const isFormValid =
    customerName.trim().length >= 2 &&
    isPhoneValid &&
    address.trim().length >= 5 &&
    isAddressDeliverable &&
    !checkingDelivery &&
    validLines.length > 0;

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
        people: people,
        goal: goal,
        lines: validLines.map((line) => ({
          dishId: line.dish.id,
          grams: line.grams,
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

      // Lưu mã token vào lịch sử thiết bị để khách dễ dàng theo dõi
      try {
        const stored = JSON.parse(localStorage.getItem("mhln_my_orders") || "[]");
        const nextList = [
          {
            publicToken: data.publicToken,
            publicCode: data.publicCode,
            customerName: customerName.trim(),
            createdAt: new Date().toISOString(),
          },
          ...stored.filter((item: { publicToken?: string }) => item.publicToken !== data.publicToken),
        ].slice(0, 10);
        localStorage.setItem("mhln_my_orders", JSON.stringify(nextList));
      } catch {
        // Bỏ qua nếu trình duyệt chặn localStorage
      }

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

          <div className="relative">
            <div className="flex items-center justify-between">
              <label className="block font-mono text-xs font-bold uppercase tracking-[0.14em] text-forest">
                Địa chỉ nhận hàng (Hà Nội){" "}
                <span className="text-coral">*</span>
              </label>
              <span className="font-mono text-[10px] text-muted">
                Bán kính 20km từ 91 Chùa Láng
              </span>
            </div>

            {/* GỢI Ý NHANH CÁC ĐỊA ĐIỂM QUANH 91 CHÙA LÁNG & HÀ NỘI */}
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <span className="font-mono text-[10px] text-muted">Gợi ý nhanh:</span>
              {[
                { label: "91 Chùa Láng", address: "91 Chùa Láng, Phường Láng Thượng, Quận Đống Đa, Hà Nội" },
                { label: "ĐH Ngoại Thương", address: "Đại học Ngoại Thương (FTU) - 91 Chùa Láng, Đống Đa, Hà Nội" },
                { label: "HV Ngoại Giao", address: "Học viện Ngoại Giao (DAV) - 69 Chùa Láng, Đống Đa, Hà Nội" },
                { label: "ĐH Luật Hà Nội", address: "Trường Đại học Luật Hà Nội - 87 Nguyễn Chí Thanh, Đống Đa, Hà Nội" },
                { label: "Vincom NCT", address: "Vincom Center Nguyễn Chí Thanh - 54A Nguyễn Chí Thanh, Đống Đa, Hà Nội" },
                { label: "Duy Tân Cầu Giấy", address: "Phố Duy Tân, Phường Dịch Vọng Hậu, Quận Cầu Giấy, Hà Nội" },
                { label: "Keangnam Phạm Hùng", address: "Tòa nhà Keangnam Hanoi Landmark 72, Phạm Hùng, Nam Từ Liêm, Hà Nội" },
              ].map((chip) => (
                <button
                  key={chip.label}
                  type="button"
                  onClick={() => {
                    setAddress(chip.address);
                    setSelectedPlaceId(null);
                    setShowPredictions(false);
                    setTouchedAddress(true);
                    verifyAddressDistance({ address: chip.address });
                  }}
                  className="rounded border border-forest/20 bg-forest/5 px-2 py-0.5 text-[11px] font-medium text-forest transition hover:bg-forest hover:text-white"
                >
                  + {chip.label}
                </button>
              ))}
            </div>

            {/* Ô NHẬP ĐỊA CHỈ KÈM BIỂU TƯỢNG VÀ AUTOCOMPLETE */}
            <div className="relative mt-2">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-muted">
                <svg className="h-4 w-4 text-forest" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                </svg>
              </div>

              <input
                type="text"
                required
                placeholder="Gõ số nhà, tên đường, tòa nhà hoặc trường học tại Hà Nội..."
                value={address}
                onChange={(e) => {
                  setAddress(e.target.value);
                  setSelectedPlaceId(null);
                  setDeliveryCheck(null);
                  setTouchedAddress(true);
                }}
                onKeyDown={(e) => {
                  if (predictions.length === 0) return;
                  if (e.key === "ArrowDown") {
                    e.preventDefault();
                    setActivePredictionIndex((prev) =>
                      prev < predictions.length - 1 ? prev + 1 : 0
                    );
                  } else if (e.key === "ArrowUp") {
                    e.preventDefault();
                    setActivePredictionIndex((prev) =>
                      prev > 0 ? prev - 1 : predictions.length - 1
                    );
                  } else if (e.key === "Enter" && activePredictionIndex >= 0) {
                    e.preventDefault();
                    handleSelectPrediction(predictions[activePredictionIndex]);
                  } else if (e.key === "Escape") {
                    setShowPredictions(false);
                  }
                }}
                onFocus={() => {
                  if (predictions.length > 0) setShowPredictions(true);
                }}
                onBlur={() => {
                  // Đóng dropdown sau một khoảng delay để kịp nhận click chọn
                  setTimeout(() => setShowPredictions(false), 250);
                  if (!selectedPlaceId && address.trim().length >= 5 && !deliveryCheck) {
                    verifyAddressDistance({ address: address.trim() });
                  }
                }}
                className={`w-full border bg-ivory/30 py-3 pl-9 pr-10 text-sm text-ink outline-none transition-colors focus:bg-white ${
                  touchedAddress && address && !isAddressDeliverable
                    ? "border-amber-500 focus:border-amber-600"
                    : isAddressDeliverable
                      ? "border-forest focus:border-forest"
                      : "border-rule focus:border-forest"
                }`}
              />

              {/* Icon xóa nhanh hoặc loading */}
              <div className="absolute inset-y-0 right-0 flex items-center pr-3">
                {isSearchingAddress ? (
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-forest border-t-transparent" />
                ) : address ? (
                  <button
                    type="button"
                    onClick={() => {
                      setAddress("");
                      setSelectedPlaceId(null);
                      setDeliveryCheck(null);
                      setPredictions([]);
                      setShowPredictions(false);
                    }}
                    className="text-muted hover:text-ink"
                    title="Xóa địa chỉ"
                  >
                    ✕
                  </button>
                ) : null}
              </div>
            </div>

            {/* DANH SÁCH GỢI Ý ĐỊA CHỈ TỰ ĐỘNG (AUTOCOMPLETE DROPDOWN) */}
            {showPredictions && predictions.length > 0 && (
              <ul className="absolute left-0 right-0 z-50 mt-1 max-h-64 overflow-y-auto rounded-lg border border-forest/30 bg-white py-1 shadow-2xl">
                <li className="border-b border-rule bg-ivory/40 px-3.5 py-1.5 font-mono text-[10px] font-bold uppercase tracking-wider text-muted">
                  Gợi ý địa chỉ nhận cơm (Hà Nội)
                </li>
                {predictions.map((p, idx) => (
                  <li key={p.place_id}>
                    <button
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        handleSelectPrediction(p);
                      }}
                      className={`flex w-full items-start gap-2.5 px-3.5 py-2.5 text-left text-xs transition-colors ${
                        idx === activePredictionIndex
                          ? "bg-forest/15 text-forest"
                          : "hover:bg-forest/5 focus:bg-forest/5"
                      }`}
                    >
                      <svg
                        className="mt-0.5 h-3.5 w-3.5 shrink-0 text-forest"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                        />
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                        />
                      </svg>
                      <div className="min-w-0 flex-1">
                        <strong className="block truncate font-semibold text-ink">
                          {p.main_text}
                        </strong>
                        <span className="block truncate text-[11px] text-muted">
                          {p.secondary_text}
                        </span>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {/* THÔNG BÁO TRẠNG THÁI KIỂM TRA PHẠM VI GIAO HÀNG */}
            {checkingDelivery && (
              <div className="mt-2.5 flex items-center gap-2 border-l-4 border-amber-500 bg-amber-50 px-3 py-2 font-mono text-xs text-amber-800">
                <div className="h-3 w-3 animate-spin rounded-full border-2 border-amber-600 border-t-transparent" />
                Đang kiểm tra khoảng cách giao hàng từ cửa hàng (91 Chùa Láng)…
              </div>
            )}

            {!checkingDelivery && address.trim().length > 0 && (
              <div className="mt-2.5">
                {deliveryCheck ? (
                  deliveryCheck.deliverable ? (
                    <div className="border-l-4 border-forest bg-forest/5 px-3 py-2 text-xs text-forest">
                      <p className="font-semibold">✓ Đủ điều kiện nhận cơm</p>
                      <p className="mt-0.5 font-mono text-[11px] text-muted">
                        {deliveryCheck.reason} {deliveryCheck.approximate ? "(ước tính)" : ""}
                      </p>
                    </div>
                  ) : (
                    <div
                      role="alert"
                      className="border-l-4 border-amber-600 bg-amber-50 px-3.5 py-2.5 text-xs text-amber-900"
                    >
                      <p className="font-bold">Địa chỉ ngoài phạm vi giao hàng 20km</p>
                      <p className="mt-0.5">{deliveryCheck.reason}</p>
                    </div>
                  )
                ) : addressValidation.inService ? (
                  <p className="border-l-4 border-forest bg-forest/5 px-3 py-2 text-xs font-semibold text-forest">
                    ✓ Địa chỉ hợp lệ ({addressValidation.matchedDistrict})
                  </p>
                ) : (
                  <div
                    role="alert"
                    className="border-l-4 border-amber-600 bg-amber-50 px-3.5 py-2.5 text-xs text-amber-900"
                  >
                    <p className="font-bold">Địa chỉ ngoài vùng phục vụ</p>
                    <p className="mt-1">{addressValidation.message}</p>
                  </div>
                )}
              </div>
            )}

            {!address && (
              <p className="mt-1.5 text-[11px] text-muted">
                Phục vụ giao cơm tận nơi trong bán kính 20km tính từ 91 Chùa Láng, Đống Đa, Hà Nội.
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
              Món đã chọn ({validLines.length} món)
            </h2>

            <div className="divide-y divide-white/10">
              {validLines.map((line) => {
                const itemGrams = line.grams;
                const yieldG = line.dish.yield_g > 0 ? line.dish.yield_g : 350;
                const itemPrice = Math.round(
                  (line.dish.price_vnd / yieldG) * itemGrams
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
                <span>Tạm tính ({validLines.length} món · bàn {people} người)</span>
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
                    : `Đặt cơm & Chuyển khoản · ${formatVnd(Math.round(total))}`}
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
