"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import type { OrderRecord } from "@/lib/types";
import { formatVnd } from "@/lib/format";
import { BANK_CONFIG } from "@/lib/bank-config";

export function PaymentView({
  order,
  vietQrImageUrl,
  qrSvgUrl,
}: {
  order: OrderRecord;
  vietQrImageUrl: string;
  qrSvgUrl: string;
}) {
  const router = useRouter();
  const [copyFeedback, setCopyFeedback] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

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

  const copyAllInfo = () => {
    const fullText = `Ngân hàng: ${BANK_CONFIG.bankName}\nSố tài khoản: ${BANK_CONFIG.account}\nChủ tài khoản: ${BANK_CONFIG.accountName}\nSố tiền: ${order.total_vnd}\nNội dung: ${order.public_code}`;
    copyToClipboard(fullText, "toàn bộ thông tin chuyển khoản");
  };

  const handleDownloadQr = async () => {
    try {
      const res = await fetch(qrSvgUrl);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `VietQR-${order.public_code}.svg`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      window.open(vietQrImageUrl, "_blank");
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

      router.push(`/orders/${order.public_token}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Có lỗi xảy ra.");
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-8">
      <header className="flex flex-col justify-between gap-3 border-b-2 border-forest pb-5 sm:flex-row sm:items-end">
        <div>
          <p className="font-mono text-[11px] font-bold uppercase tracking-[0.2em] text-coral">
            Mở Hộp Là Nhà · Cổng thanh toán chuyển khoản VietQR
          </p>
          <h1 className="mt-1 font-display text-4xl font-semibold tracking-[-0.02em] text-forest">
            Mã QR Thanh Toán
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs font-semibold uppercase tracking-[0.16em] text-muted">
            Mã đơn:
          </span>
          <span className="bg-forest px-3 py-1 font-mono text-xs font-bold text-white shadow-sm">
            #{order.public_code}
          </span>
        </div>
      </header>

      <div className="grid gap-10 lg:grid-cols-12 lg:items-start">
        {/* Cột trái: Khung mã QR chuẩn biên tập */}
        <section className="border border-rule bg-white p-6 text-center shadow-sm sm:p-8 lg:col-span-5">
          <p className="text-xs leading-relaxed text-muted">
            Quét mã bằng bất kỳ ứng dụng ngân hàng hoặc ví điện tử hỗ trợ VietQR / Napas 247.
          </p>

          <div className="mx-auto mt-6 w-64 max-w-full border-2 border-forest bg-white p-3 shadow-inner">
            <Image
              src={qrSvgUrl}
              alt={`Mã VietQR đơn hàng ${order.public_code}`}
              width={224}
              height={224}
              unoptimized
              className="mx-auto h-56 w-56 max-w-full object-contain"
            />
          </div>

          <div className="mt-6 border-t border-rule pt-4">
            <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">
              Số tiền cần thanh toán
            </span>
            <p className="mt-1 font-display text-3xl font-bold text-coral sm:text-4xl">
              {formatVnd(order.total_vnd)}
            </p>
          </div>

          <div className="mt-6 grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={handleDownloadQr}
              className="border-2 border-forest bg-transparent py-3 font-mono text-xs font-bold uppercase tracking-[0.12em] text-forest transition-colors hover:bg-forest hover:text-white"
            >
              Lưu mã QR
            </button>
            <button
              type="button"
              onClick={copyAllInfo}
              className="border-2 border-forest bg-transparent py-3 font-mono text-xs font-bold uppercase tracking-[0.12em] text-forest transition-colors hover:bg-forest hover:text-white"
            >
              Sao chép thông tin
            </button>
          </div>

          {copyFeedback && (
            <p className="mt-4 border-l-4 border-forest bg-forest/10 px-3 py-2 text-left font-mono text-xs font-semibold text-forest">
              ✓ {copyFeedback}
            </p>
          )}
        </section>

        {/* Cột phải: Bảng chuyển khoản thủ công & xác nhận */}
        <div className="space-y-6 lg:col-span-7">
          <section className="border border-rule bg-white p-6 shadow-sm sm:p-8">
            <h2 className="border-b border-rule pb-3 font-display text-xl font-semibold text-forest">
              Thông tin chuyển khoản thủ công
            </h2>

            <dl className="mt-2 divide-y divide-rule text-sm">
              <div className="flex items-center justify-between gap-4 py-3.5">
                <div>
                  <dt className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">
                    Ngân hàng thụ hưởng
                  </dt>
                  <dd className="mt-0.5 font-bold text-ink">
                    {BANK_CONFIG.bankName}
                  </dd>
                </div>
                <button
                  type="button"
                  onClick={() => copyToClipboard(BANK_CONFIG.bin, "Mã BIN")}
                  className="font-mono text-xs font-bold uppercase tracking-[0.12em] text-forest underline hover:text-coral"
                >
                  Chép BIN
                </button>
              </div>

              <div className="flex items-center justify-between gap-4 py-3.5">
                <div>
                  <dt className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">
                    Số tài khoản
                  </dt>
                  <dd className="mt-0.5 font-mono text-base font-bold text-forest">
                    {BANK_CONFIG.account}
                  </dd>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    copyToClipboard(BANK_CONFIG.account, "Số tài khoản")
                  }
                  className="border border-forest/30 bg-ivory/50 px-3 py-1.5 font-mono text-xs font-bold uppercase tracking-[0.12em] text-forest transition-colors hover:bg-forest hover:text-white"
                >
                  Sao chép
                </button>
              </div>

              <div className="flex items-center justify-between gap-4 py-3.5">
                <div>
                  <dt className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">
                    Chủ tài khoản
                  </dt>
                  <dd className="mt-0.5 font-bold text-ink">
                    {BANK_CONFIG.accountName}
                  </dd>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    copyToClipboard(BANK_CONFIG.accountName, "Tên chủ tài khoản")
                  }
                  className="border border-forest/30 bg-ivory/50 px-3 py-1.5 font-mono text-xs font-bold uppercase tracking-[0.12em] text-forest transition-colors hover:bg-forest hover:text-white"
                >
                  Sao chép
                </button>
              </div>

              <div className="flex items-center justify-between gap-4 border-l-4 border-l-coral bg-coral/10 px-4 py-3.5">
                <div>
                  <dt className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-coral">
                    Nội dung chuyển khoản (chính xác)
                  </dt>
                  <dd className="mt-0.5 font-mono text-xl font-bold text-forest">
                    {order.public_code}
                  </dd>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    copyToClipboard(order.public_code, "Nội dung chuyển khoản")
                  }
                  className="bg-coral px-4 py-2 font-mono text-xs font-bold uppercase tracking-[0.12em] text-white shadow-sm transition-colors hover:bg-coral-hover"
                >
                  Sao chép
                </button>
              </div>
            </dl>
          </section>

          <section className="border border-rule bg-white p-6 shadow-sm">
            <h2 className="font-mono text-xs font-bold uppercase tracking-[0.18em] text-forest">
              Hướng dẫn thanh toán 3 bước
            </h2>
            <ol className="mt-4 divide-y divide-rule text-xs leading-relaxed text-muted">
              <li className="flex items-start gap-3 py-3 first:pt-0">
                <span className="font-mono font-bold text-coral">01</span>
                <span>
                  Mở ứng dụng ngân hàng hoặc ví điện tử bất kỳ của bạn (VCB, MB, Techcombank, VPBank…).
                </span>
              </li>
              <li className="flex items-start gap-3 py-3">
                <span className="font-mono font-bold text-coral">02</span>
                <span>
                  Chọn <strong>Quét mã QR</strong> hoặc chuyển khoản nhanh 24/7 với đúng nội dung{" "}
                  <strong className="font-mono text-coral font-bold">
                    {order.public_code}
                  </strong>
                  .
                </span>
              </li>
              <li className="flex items-start gap-3 py-3 last:pb-0">
                <span className="font-mono font-bold text-coral">03</span>
                <span>
                  Kiểm tra đúng số tiền{" "}
                  <strong className="text-forest font-bold">
                    {formatVnd(order.total_vnd)}
                  </strong>
                  , hoàn tất chuyển tiền rồi nhấn nút{" "}
                  <strong className="text-forest font-bold">&quot;Tôi đã chuyển khoản&quot;</strong> bên dưới.
                </span>
              </li>
            </ol>
          </section>

          {error && (
            <div className="border-l-4 border-coral bg-white p-4 text-xs font-medium text-red-700 shadow-sm">
              {error}
            </div>
          )}

          {/* Nút 'Tôi đã chuyển khoản' CHỈ đặt status='pending_verification' */}
          <div>
            <button
              type="button"
              onClick={handleConfirmTransfer}
              disabled={isSubmitting}
              className="flex w-full items-center justify-center gap-2 bg-coral py-4 text-center font-mono text-xs font-bold uppercase tracking-[0.18em] text-white shadow-md transition-all hover:bg-coral-hover hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral focus-visible:ring-offset-2 disabled:opacity-50"
            >
              <span>
                {isSubmitting
                  ? "Đang ghi nhận chuyển khoản…"
                  : "Tôi đã chuyển khoản"}
              </span>
              {!isSubmitting && <span aria-hidden="true">✓</span>}
            </button>
            <p className="mt-2.5 text-center text-[11px] leading-relaxed text-muted">
              Sau khi bạn xác nhận, đơn hàng chuyển sang trạng thái{" "}
              <strong className="text-forest font-bold">
                Đang đối soát (pending_verification)
              </strong>{" "}
              để nhân viên bếp kiểm tra và chuẩn bị cơm.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
