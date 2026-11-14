"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { OrderRecord, OrderStatus } from "@/lib/types";
import { formatVnd } from "@/lib/format";
import {
  getCustomerOrderLabel,
  getOrderStepProgress,
  ORDER_5_STEPS,
} from "@/lib/order-labels";

function maskPhone(phone: string): string {
  const cleaned = phone.trim();
  if (cleaned.length >= 10) {
    return `${cleaned.slice(0, 3)}****${cleaned.slice(-3)}`;
  }
  return cleaned.slice(0, 2) + "****";
}

function maskAddress(addr: string): string {
  return addr.replace(/^\d+[\w/-]*\s+/, "*** ");
}

export function OrderStatusView({ order: initialOrder }: { order: OrderRecord }) {
  const [order, setOrder] = useState<OrderRecord>(initialOrder);

  // Polling tự động mỗi 5 giây để cập nhật trạng thái khi bếp xác nhận
  useEffect(() => {
    let isCancelled = false;

    if (order.status === "delivered" || order.status === "cancelled") {
      return;
    }

    const checkStatus = async () => {
      try {
        const res = await fetch(`/api/orders/${order.public_token}/status`, {
          cache: "no-store",
        });
        if (!res.ok) return;
        const data = await res.json();
        if (isCancelled || !data || !data.status) return;

        const remoteStatus: OrderStatus = data.status;
        if (remoteStatus !== order.status) {
          setOrder((prev) => ({
            ...prev,
            status: remoteStatus,
            paid_at: data.paidAt ?? prev.paid_at,
            cooking_at: data.cookingAt ?? prev.cooking_at,
            packed_at: data.packedAt ?? prev.packed_at,
            delivered_at: data.deliveredAt ?? prev.delivered_at,
          }));
        }
      } catch {
        // Bỏ qua lỗi kết nối tạm thời
      }
    };

    const interval = setInterval(checkStatus, 5000);
    return () => {
      isCancelled = true;
      clearInterval(interval);
    };
  }, [order.public_token, order.status]);

  const progress = getOrderStepProgress(order.status);
  const statusLabel = getCustomerOrderLabel(order.status);

  return (
    <div className="space-y-8">
      {/* Header trạng thái đơn */}
      <header className="flex flex-col justify-between gap-4 border-b-2 border-forest pb-5 sm:flex-row sm:items-end">
        <div>
          <span className="font-mono text-[11px] font-bold uppercase tracking-[0.2em] text-coral">
            Hồ sơ đơn hàng · Mở Hộp Là Nhà
          </span>
          <h1 className="mt-1 font-display text-3xl font-bold tracking-tight text-forest sm:text-4xl">
            #{order.public_code}
          </h1>
          <p className="mt-1 font-mono text-xs text-muted">
            Mã chuyển khoản &amp; đối soát:{" "}
            <strong className="text-forest">#{order.public_code}</strong>
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span
            className={`inline-block border-2 px-3.5 py-1.5 font-mono text-xs font-bold uppercase tracking-[0.14em] shadow-sm ${
              order.status === "cancelled"
                ? "border-red-700 bg-red-50 text-red-800"
                : order.status === "paid" || order.status === "cooking"
                  ? "border-forest bg-forest text-white"
                  : order.status === "delivered"
                    ? "border-forest bg-forest text-white"
                    : "border-coral bg-coral/10 text-coral"
            }`}
          >
            {statusLabel}
          </span>
        </div>
      </header>

      {/* THANH TIẾN TRÌNH 5 BƯỚC CHUẨN BIÊN TẬP */}
      <section className="border border-rule bg-white p-6 shadow-sm sm:p-8">
        <div className="flex items-center justify-between border-b border-rule pb-3">
          <h2 className="font-mono text-xs font-bold uppercase tracking-[0.18em] text-forest">
            Tiến độ thực hiện đơn hàng (5 bước)
          </h2>
          <span className="font-mono text-xs font-bold text-coral">
            {progress.isCancelled ? "Đơn đã hủy" : `Bước ${progress.currentStep}/5`}
          </span>
        </div>

        {progress.isCancelled ? (
          <div className="mt-5 border-l-4 border-red-700 bg-red-50 p-4 text-xs font-medium text-red-800">
            Đơn hàng đã bị hủy{" "}
            {order.cancel_reason === "expired"
              ? "(do hết hạn thời gian thanh toán). Nếu bạn đã chuyển khoản, vui lòng liên hệ bếp để được khôi phục."
              : "."}
          </div>
        ) : (
          <div className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-5 sm:gap-px sm:bg-rule">
            {ORDER_5_STEPS.map((s) => {
              const isCompleted = progress.completedSteps.includes(s.step);
              const isCurrent = progress.currentStep === s.step;

              return (
                <div
                  key={s.step}
                  className={`relative p-3.5 sm:p-4 transition-colors ${
                    isCurrent
                      ? "bg-coral/10 sm:bg-coral/10"
                      : isCompleted
                        ? "bg-forest/10 sm:bg-forest/10"
                        : "bg-white sm:bg-white"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={`font-mono text-[10px] font-bold uppercase tracking-[0.14em] ${
                        isCurrent
                          ? "text-coral"
                          : isCompleted
                            ? "text-forest"
                            : "text-muted"
                      }`}
                    >
                      0{s.step} · {isCompleted ? "Xong" : isCurrent ? "Đang xử lý" : "Chờ"}
                    </span>
                    {isCompleted && (
                      <span className="font-mono text-xs font-bold text-forest">✓</span>
                    )}
                  </div>
                  <p
                    className={`mt-1 font-display text-sm sm:text-base font-bold ${
                      isCurrent
                        ? "text-coral"
                        : isCompleted
                          ? "text-forest"
                          : "text-muted/80"
                    }`}
                  >
                    {s.label}
                  </p>
                  <span className="mt-0.5 block text-[11px] text-muted line-clamp-1">
                    {s.description}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {/* Thông báo chi tiết cho khách theo từng trạng thái */}
        <div className="mt-5 border-l-4 border-l-coral bg-coral/5 px-4 py-3.5 text-sm text-ink">
          {order.status === "awaiting_payment" && (
            <div>
              <p className="font-medium leading-relaxed">
                Đơn hàng đang chờ bạn chuyển khoản ngân hàng. Sau khi chuyển xong, bếp sẽ đối soát và chuẩn bị ngay.
              </p>
              <Link
                href={`/payment/${order.public_token}`}
                className="mt-3.5 inline-block bg-coral px-5 py-2.5 font-mono text-xs font-bold uppercase tracking-[0.14em] text-white shadow-sm transition-all hover:bg-coral-hover"
              >
                Mở thông tin chuyển khoản →
              </Link>
            </div>
          )}

          {order.status === "pending_verification" && (
            <p className="font-medium leading-relaxed">
              ✓ Đã ghi nhận thông báo chuyển khoản của bạn. Bếp đang kiểm tra tài khoản và sẽ bắt đầu chuẩn bị cơm ngay trong ít phút!
            </p>
          )}

          {(order.status === "paid" || order.status === "cooking") && (
            <p className="font-medium leading-relaxed">
              ✓ <strong>Đã nhận đơn, đang chuẩn bị:</strong> Bếp đã nhận được thanh toán và đang cân định lượng, nấu mẻ tươi theo đúng tiêu chuẩn dinh dưỡng của bạn.
            </p>
          )}

          {order.status === "packed" && (
            <p className="font-medium leading-relaxed">
              ✓ <strong>Đã chuẩn bị xong, chờ giao:</strong> Phần cơm đã được cân định lượng, dán tem Nutrition QR và sẵn sàng bàn giao cho đối tác giao hàng.
            </p>
          )}

          {order.status === "delivered" && (
            <p className="font-medium leading-relaxed">
              ✓ <strong>Đã giao thành công:</strong> Chúc bạn và gia đình có một bữa cơm nhà ấm cúng, trọn vẹn dinh dưỡng!
            </p>
          )}
        </div>
      </section>

      {/* CHI TIẾT MÓN ĂN & THÔNG TIN GIAO HÀNG */}
      <div className="grid gap-8 lg:grid-cols-12 lg:items-start">
        {/* Cột trái: Món ăn trong đơn */}
        <div className="space-y-6 lg:col-span-7">
          <section className="border border-rule bg-white p-6 shadow-sm">
            <h2 className="border-b border-rule pb-3 font-display text-xl font-semibold text-forest">
              Món ăn trong đơn ({order.items.length} món)
            </h2>
            <div className="divide-y divide-rule">
              {order.items.map((item, idx) => (
                <article key={idx} className="py-3.5">
                  <div className="flex items-baseline justify-between gap-3">
                    <div>
                      <strong className="font-display text-lg font-semibold text-ink">
                        {item.name}
                      </strong>
                      <span className="ml-2 font-mono text-xs text-muted">
                        ({item.grams}g)
                      </span>
                    </div>
                    <span className="font-mono text-base font-bold tabular-nums text-coral">
                      {formatVnd(item.unitPrice)}
                    </span>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-3 font-mono text-xs tabular-nums text-muted">
                    <span>{Math.round(item.nutrition.kcal)} kcal</span>
                    <span className="text-forest font-semibold">
                      P {item.nutrition.protein.toFixed(1)}g
                    </span>
                    <span>C {item.nutrition.carbs.toFixed(1)}g</span>
                    <span>F {item.nutrition.fat.toFixed(1)}g</span>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section className="border border-rule bg-white p-6 shadow-sm">
            <h2 className="border-b border-rule pb-3 font-display text-xl font-semibold text-forest">
              Thông tin nhận cơm
            </h2>
            <div className="mt-3 space-y-2 text-sm text-muted">
              <p>
                <strong className="text-ink font-semibold">{order.customer_name}</strong> ·{" "}
                <span className="font-mono text-forest font-semibold">
                  {maskPhone(order.phone)}
                </span>
              </p>
              <p className="text-ink">{maskAddress(order.delivery_address)}</p>
              {order.note && (
                <p className="mt-2 border-l-4 border-coral bg-coral/5 px-3 py-2 text-xs text-ink">
                  Ghi chú: {order.note}
                </p>
              )}
            </div>
          </section>
        </div>

        {/* Cột phải: Tổng tiền thanh toán */}
        <div className="space-y-6 lg:col-span-5">
          <section className="border border-rule bg-white p-6 shadow-sm">
            <h2 className="border-b border-rule pb-3 font-display text-xl font-semibold text-forest">
              Thanh toán
            </h2>
            <dl className="mt-3 divide-y divide-rule text-sm">
              <div className="flex justify-between py-2 text-muted">
                <dt>Tiền món</dt>
                <dd className="font-mono font-medium text-ink">
                  {formatVnd(order.subtotal_vnd)}
                </dd>
              </div>
              <div className="flex justify-between py-2 text-muted">
                <dt>Phí giao hàng nội thành</dt>
                <dd className="font-mono font-medium text-ink">
                  {formatVnd(order.shipping_fee_vnd)}
                </dd>
              </div>
              <div className="flex items-baseline justify-between pt-3 font-bold">
                <dt className="text-forest">Tổng thanh toán</dt>
                <dd className="font-display text-2xl text-coral sm:text-3xl">
                  {formatVnd(order.total_vnd)}
                </dd>
              </div>
            </dl>
          </section>
        </div>
      </div>
    </div>
  );
}

