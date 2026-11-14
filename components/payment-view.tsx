"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import type { OrderRecord, OrderStatus } from "@/lib/types";
import type { BankConfig } from "@/lib/bank-config";
import { formatVnd } from "@/lib/format";
import { getCustomerOrderLabel } from "@/lib/order-labels";

export function PaymentView({
  order: initialOrder,
  bankConfig,
}: {
  order: OrderRecord;
  bankConfig: BankConfig;
}) {
  const router = useRouter();
  const [order, setOrder] = useState<OrderRecord>(initialOrder);
  const [copyFeedback, setCopyFeedback] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [hasNotifiedTransfer, setHasNotifiedTransfer] = useState(
    initialOrder.status === "pending_verification"
  );

  // Tính thời gian hết hạn (theo expires_at, mặc định 60 phút từ created_at)
  const expiresAtMs = order.expires_at
    ? new Date(order.expires_at).getTime()
    : new Date(order.created_at).getTime() + (bankConfig.paymentWindowMin || 60) * 60 * 1000;

  const [timeLeftSec, setTimeLeftSec] = useState<number>(() => {
    return Math.max(0, Math.floor((expiresAtMs - Date.now()) / 1000));
  });

  // Đếm ngược thời gian còn lại của đơn hàng
  useEffect(() => {
    const timer = setInterval(() => {
      const remaining = Math.max(0, Math.floor((expiresAtMs - Date.now()) / 1000));
      setTimeLeftSec(remaining);
      if (remaining <= 0) {
        clearInterval(timer);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [expiresAtMs]);

  // Polling tự động mỗi 5 giây kiểm tra trạng thái đơn tới khi không còn ở trạng thái chờ
  useEffect(() => {
    let isCancelled = false;

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
          setOrder((prev) => ({ ...prev, status: remoteStatus }));

          if (remoteStatus === "pending_verification") {
            setHasNotifiedTransfer(true);
          }

          // Khi đơn chuyển sang paid hoặc bất kỳ trạng thái nào sau chờ: tự chuyển sang trang theo dõi
          if (
            remoteStatus === "paid" ||
            remoteStatus === "cooking" ||
            remoteStatus === "packed" ||
            remoteStatus === "delivered" ||
            remoteStatus === "cancelled"
          ) {
            router.push(`/orders/${order.public_token}`);
          }
        }
      } catch {
        // Bỏ qua lỗi mạng tạm thời trong lúc polling
      }
    };

    const interval = setInterval(checkStatus, 5000);
    return () => {
      isCancelled = true;
      clearInterval(interval);
    };
  }, [order.public_token, order.status, router]);

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopyFeedback(`Đã sao chép ${label}.`);
      setTimeout(() => setCopyFeedback(""), 2500);
    } catch {
      setCopyFeedback("Không thể tự động sao chép.");
      setTimeout(() => setCopyFeedback(""), 2500);
    }
  };

  const handleConfirmTransfer = async () => {
    setIsSubmitting(true);
    setError("");

    try {
      const res = await fetch(`/api/orders/${order.public_token}/confirm-transfer`, {
        method: "POST",
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error ?? "Không thể cập nhật trạng thái đơn hàng.");
      }

      setHasNotifiedTransfer(true);
      setOrder((prev) => ({ ...prev, status: "pending_verification" }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Có lỗi xảy ra khi gửi thông báo.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatCountdown = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  };

  const isExpired = timeLeftSec <= 0 && order.status === "awaiting_payment";

  return (
    <div className="space-y-6">
      {/* Header trang thanh toán */}
      <header className="flex flex-col justify-between gap-3 border-b-2 border-forest pb-5 sm:flex-row sm:items-end">
        <div>
          <p className="font-mono text-[11px] font-bold uppercase tracking-[0.2em] text-coral">
            Mở Hộp Là Nhà · Thanh toán chuyển khoản ngân hàng
          </p>
          <h1 className="mt-1 font-display text-3xl font-bold tracking-tight text-forest sm:text-4xl">
            Thông Tin Chuyển Khoản
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-xs font-semibold uppercase tracking-[0.16em] text-muted">
            Mã đơn:
          </span>
          <span className="bg-forest px-3 py-1 font-mono text-xs font-bold text-white shadow-sm">
            #{order.public_code}
          </span>
          <span className="border border-forest/30 bg-ivory px-2.5 py-1 font-mono text-[11px] font-bold text-forest">
            {getCustomerOrderLabel(order.status)}
          </span>
        </div>
      </header>

      {/* Thông báo sao chép */}
      {copyFeedback && (
        <div className="border-l-4 border-forest bg-forest/10 px-4 py-2.5 font-mono text-xs font-semibold text-forest">
          ✓ {copyFeedback}
        </div>
      )}

      {/* Thông báo hết hạn nếu đơn quá hạn */}
      {isExpired && (
        <div className="border-l-4 border-coral bg-coral/10 p-4 text-xs font-semibold text-red-700">
          ⚠️ Đơn hàng đã quá thời gian chờ thanh toán ({bankConfig.paymentWindowMin || 60} phút). Vui lòng liên hệ bếp hoặc đặt đơn mới.
        </div>
      )}

      <div className="grid gap-8 lg:grid-cols-12 lg:items-start">
        {/* CỘT CHÍNH: THẺ THÔNG TIN TÀI KHOẢN NGÂN HÀNG */}
        <section className="border-2 border-forest bg-white p-6 shadow-sm sm:p-8 lg:col-span-7">
          <div className="flex items-center justify-between border-b border-rule pb-4">
            <div>
              <span className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-coral">
                Tài khoản nhận tiền chính thức
              </span>
              <h2 className="mt-0.5 font-display text-xl font-bold text-forest">
                Chuyển Khoản Ngân Hàng
              </h2>
            </div>

            {/* Đồng hồ đếm ngược thời gian còn lại */}
            <div className="text-right">
              <span className="block font-mono text-[10px] uppercase tracking-wider text-muted">
                Thời gian giữ đơn
              </span>
              <span
                className={`font-mono text-sm font-bold tabular-nums ${
                  timeLeftSec < 300 ? "text-coral animate-pulse" : "text-forest"
                }`}
              >
                {formatCountdown(timeLeftSec)}
              </span>
            </div>
          </div>

          <dl className="mt-2 divide-y divide-rule text-sm">
            {/* 1. Ngân hàng */}
            <div className="flex items-center justify-between gap-4 py-3.5">
              <div>
                <dt className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">
                  Ngân hàng thụ hưởng
                </dt>
                <dd className="mt-0.5 font-bold text-ink">
                  {bankConfig.bankName}
                </dd>
              </div>
              <button
                type="button"
                onClick={() => copyToClipboard(bankConfig.bankName, "Tên ngân hàng")}
                className="border border-forest/30 bg-ivory px-3 py-1.5 font-mono text-xs font-bold uppercase tracking-[0.1em] text-forest transition-colors hover:bg-forest hover:text-white"
              >
                Sao chép
              </button>
            </div>

            {/* 2. Số tài khoản */}
            <div className="flex items-center justify-between gap-4 py-3.5">
              <div>
                <dt className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">
                  Số tài khoản
                </dt>
                <dd className="mt-0.5 font-mono text-lg font-bold text-forest">
                  {bankConfig.accountNo}
                </dd>
              </div>
              <button
                type="button"
                onClick={() => copyToClipboard(bankConfig.accountNo, "Số tài khoản")}
                className="border border-forest/30 bg-ivory px-3 py-1.5 font-mono text-xs font-bold uppercase tracking-[0.1em] text-forest transition-colors hover:bg-forest hover:text-white"
              >
                Sao chép
              </button>
            </div>

            {/* 3. Chủ tài khoản */}
            <div className="flex items-center justify-between gap-4 py-3.5">
              <div>
                <dt className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">
                  Chủ tài khoản
                </dt>
                <dd className="mt-0.5 font-bold text-ink">
                  {bankConfig.accountHolder}
                </dd>
              </div>
              <button
                type="button"
                onClick={() => copyToClipboard(bankConfig.accountHolder, "Tên chủ tài khoản")}
                className="border border-forest/30 bg-ivory px-3 py-1.5 font-mono text-xs font-bold uppercase tracking-[0.1em] text-forest transition-colors hover:bg-forest hover:text-white"
              >
                Sao chép
              </button>
            </div>

            {/* 4. Số tiền chính xác */}
            <div className="flex items-center justify-between gap-4 py-3.5">
              <div>
                <dt className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">
                  Số tiền chính xác
                </dt>
                <dd className="mt-0.5 font-display text-2xl font-bold text-coral sm:text-3xl">
                  {formatVnd(order.total_vnd)}
                </dd>
              </div>
              <button
                type="button"
                onClick={() => copyToClipboard(order.total_vnd.toString(), "Số tiền")}
                className="border border-forest/30 bg-ivory px-3 py-1.5 font-mono text-xs font-bold uppercase tracking-[0.1em] text-forest transition-colors hover:bg-forest hover:text-white"
              >
                Sao chép
              </button>
            </div>

            {/* 5. Nội dung chuyển khoản (chỉ chữ và số) */}
            <div className="flex items-center justify-between gap-4 border-l-4 border-l-coral bg-coral/10 px-4 py-4">
              <div>
                <dt className="font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-coral">
                  Nội dung chuyển khoản (bắt buộc chính xác)
                </dt>
                <dd className="mt-1 font-mono text-2xl font-black text-forest">
                  {order.public_code}
                </dd>
                <span className="text-[11px] text-muted">
                  Chỉ ghi mã đơn này, không thêm ký tự khác.
                </span>
              </div>
              <button
                type="button"
                onClick={() => copyToClipboard(order.public_code, "Nội dung chuyển khoản")}
                className="bg-coral px-4 py-2.5 font-mono text-xs font-bold uppercase tracking-[0.14em] text-white shadow-sm transition-colors hover:bg-coral-hover"
              >
                Sao chép
              </button>
            </div>
          </dl>
        </section>

        {/* CỘT PHỤ: 3 BƯỚC HƯỚNG DẪN & NÚT XÁC NHẬN */}
        <div className="space-y-6 lg:col-span-5">
          {/* Hướng dẫn 3 bước ngắn gọn */}
          <section className="border border-rule bg-white p-6 shadow-sm">
            <h3 className="font-mono text-xs font-bold uppercase tracking-[0.18em] text-forest">
              Hướng dẫn 3 bước thanh toán
            </h3>
            <ol className="mt-4 divide-y divide-rule text-xs leading-relaxed text-ink/80">
              <li className="flex items-start gap-3 py-3 first:pt-0">
                <span className="font-mono font-bold text-coral">01</span>
                <span>
                  Mở ứng dụng ngân hàng hoặc ví điện tử bất kỳ của bạn (VCB, MB, Techcombank, VPBank…).
                </span>
              </li>
              <li className="flex items-start gap-3 py-3">
                <span className="font-mono font-bold text-coral">02</span>
                <span>
                  Chọn <strong>Chuyển khoản nhanh 24/7</strong> và nhập đúng Số tài khoản, Ngân hàng, Số tiền như bên cạnh.
                </span>
              </li>
              <li className="flex items-start gap-3 py-3 last:pb-0">
                <span className="font-mono font-bold text-coral">03</span>
                <span>
                  Nhập đúng Nội dung chuyển khoản là{" "}
                  <strong className="font-mono font-bold text-coral">
                    {order.public_code}
                  </strong>
                  . Hoàn tất giao dịch rồi bấm nút thông báo bên dưới.
                </span>
              </li>
            </ol>
          </section>

          {error && (
            <div className="border-l-4 border-coral bg-white p-4 text-xs font-medium text-red-700 shadow-sm">
              {error}
            </div>
          )}

          {/* Trạng thái xác nhận của khách */}
          <section className="border border-rule bg-white p-6 shadow-sm">
            {hasNotifiedTransfer ? (
              <div className="border-l-4 border-forest bg-forest/10 p-4 text-left">
                <p className="font-bold text-forest">
                  ✓ Đã ghi nhận, bếp sẽ kiểm tra và xác nhận trong ít phút.
                </p>
                <p className="mt-1 text-xs text-muted">
                  Trang sẽ tự động cập nhật khi quản trị viên xác nhận đã nhận tiền (không cần tải lại).
                </p>
              </div>
            ) : (
              <div>
                <button
                  type="button"
                  onClick={handleConfirmTransfer}
                  disabled={isSubmitting || isExpired}
                  className="flex w-full items-center justify-center gap-2 rounded-sm bg-coral py-3.5 text-center font-mono text-xs font-bold uppercase tracking-[0.16em] text-white shadow-sm transition-all hover:bg-coral-hover active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-muted/50"
                >
                  <span>
                    {isSubmitting
                      ? "Đang ghi nhận chuyển khoản…"
                      : "Tôi đã chuyển khoản"}
                  </span>
                  {!isSubmitting && <span aria-hidden="true">✓</span>}
                </button>
                <p className="mt-2.5 text-center text-[11px] leading-relaxed text-muted">
                  Bấm nút này để thông báo cho bếp ưu tiên đối soát đơn của bạn. Thao tác này là không bắt buộc.
                </p>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
