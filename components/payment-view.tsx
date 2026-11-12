"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { OrderRecord } from "@/lib/types";
import { formatVnd } from "@/lib/format";
import { BANK_CONFIG } from "@/lib/bank-config";

export function PaymentView({
  order,
  vietQrImageUrl,
  qrSvgUrl
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
      setCopyFeedback(`Đã sao chép ${label}!`);
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
      // Tải qua ảnh SVG hoặc VietQR URL
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
      const res = await fetch(`/api/orders/${order.id}/confirm-transfer`, {
        method: "POST"
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error ?? "Không thể cập nhật trạng thái đơn hàng.");
      }

      // Chuyển hướng sang trang theo dõi đơn hàng /orders/[code]
      router.push(`/orders/${order.public_code}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Có lỗi xảy ra.");
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Thẻ QR Code */}
      <section className="rounded-3xl border border-amber-100 bg-white p-6 text-center shadow-md">
        <p className="text-xs font-bold uppercase tracking-widest text-orange-600">
          Mở Hộp Là Nhà · Thanh toán VietQR
        </p>
        <h1 className="mt-2 text-2xl font-black text-brand-950">Mã QR Thanh Toán</h1>
        <p className="mt-1 text-xs text-slate-500">
          Quét mã bằng bất kỳ ứng dụng ngân hàng nào hỗ trợ VietQR / Napas 247
        </p>

        {/* Khung ảnh QR */}
        <div className="relative mx-auto mt-5 w-64 max-w-full rounded-2xl border-2 border-dashed border-brand-200 bg-white p-3 shadow-inner">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={qrSvgUrl}
            alt={`Mã VietQR đơn hàng ${order.public_code}`}
            className="mx-auto h-56 w-56 max-w-full rounded-xl object-contain"
            onError={(e) => {
              // Fallback nếu SVG bị lỗi
              (e.target as HTMLImageElement).src = vietQrImageUrl;
            }}
          />
        </div>

        {/* Số tiền nổi bật */}
        <div className="mt-4">
          <span className="text-xs font-semibold text-slate-500">Số tiền cần thanh toán</span>
          <p className="text-3xl font-black text-brand-700">{formatVnd(order.total_vnd)}</p>
        </div>

        {/* Hai nút hành động nhanh: Lưu QR & Sao chép tất cả */}
        <div className="mt-5 flex gap-2.5">
          <button
            type="button"
            onClick={handleDownloadQr}
            className="flex-1 rounded-xl border border-brand-300 bg-brand-50/60 py-3 text-xs font-bold text-brand-800 transition hover:bg-brand-100"
          >
            📥 Lưu mã QR
          </button>
          <button
            type="button"
            onClick={copyAllInfo}
            className="flex-1 rounded-xl border border-brand-300 bg-brand-50/60 py-3 text-xs font-bold text-brand-800 transition hover:bg-brand-100"
          >
            📋 Sao chép thông tin
          </button>
        </div>

        {copyFeedback && (
          <p className="mt-3 rounded-lg bg-emerald-50 py-1.5 text-xs font-semibold text-emerald-700 animate-fade-in">
            ✓ {copyFeedback}
          </p>
        )}
      </section>

      {/* Chi tiết tài khoản ngân hàng */}
      <section className="space-y-3 rounded-3xl bg-white p-5 shadow-sm">
        <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500">
          Thông tin chuyển khoản thủ công
        </h2>

        <div className="space-y-2.5 text-sm">
          {/* Ngân hàng */}
          <div className="flex items-center justify-between rounded-xl bg-slate-50 p-3">
            <div>
              <span className="block text-[11px] text-slate-500">Ngân hàng thụ hưởng</span>
              <span className="font-bold text-slate-800">{BANK_CONFIG.bankName}</span>
            </div>
            <button
              type="button"
              onClick={() => copyToClipboard(BANK_CONFIG.bin, "Mã BIN")}
              className="text-xs font-semibold text-brand-700 hover:underline"
            >
              Chép BIN
            </button>
          </div>

          {/* Số tài khoản */}
          <div className="flex items-center justify-between rounded-xl bg-slate-50 p-3">
            <div>
              <span className="block text-[11px] text-slate-500">Số tài khoản</span>
              <span className="font-mono text-base font-black text-brand-950">
                {BANK_CONFIG.account}
              </span>
            </div>
            <button
              type="button"
              onClick={() => copyToClipboard(BANK_CONFIG.account, "Số tài khoản")}
              className="rounded-lg bg-white px-2.5 py-1 text-xs font-bold text-brand-700 shadow-xs border border-slate-200 hover:bg-slate-50"
            >
              Sao chép
            </button>
          </div>

          {/* Chủ tài khoản */}
          <div className="flex items-center justify-between rounded-xl bg-slate-50 p-3">
            <div>
              <span className="block text-[11px] text-slate-500">Chủ tài khoản</span>
              <span className="font-bold text-slate-800">{BANK_CONFIG.accountName}</span>
            </div>
            <button
              type="button"
              onClick={() => copyToClipboard(BANK_CONFIG.accountName, "Tên chủ tài khoản")}
              className="rounded-lg bg-white px-2.5 py-1 text-xs font-bold text-brand-700 shadow-xs border border-slate-200 hover:bg-slate-50"
            >
              Sao chép
            </button>
          </div>

          {/* Nội dung chuyển khoản (bắt buộc) */}
          <div className="flex items-center justify-between rounded-xl border-2 border-orange-200 bg-orange-50/50 p-3">
            <div>
              <span className="block text-[11px] font-bold text-orange-700">
                Nội dung chuyển khoản (chính xác)
              </span>
              <span className="font-mono text-lg font-black text-orange-950">
                {order.public_code}
              </span>
            </div>
            <button
              type="button"
              onClick={() => copyToClipboard(order.public_code, "Nội dung chuyển khoản")}
              className="rounded-lg bg-orange-500 px-3 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-orange-600"
            >
              Sao chép
            </button>
          </div>
        </div>
      </section>

      {/* Hướng dẫn mở app ngân hàng */}
      <section className="space-y-3 rounded-3xl bg-white p-5 shadow-sm">
        <h2 className="text-sm font-bold text-brand-950">Hướng dẫn thanh toán 3 bước</h2>
        <ol className="space-y-3 text-xs text-slate-600">
          <li className="flex items-start gap-3">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-700 text-[11px] font-bold text-white">
              1
            </span>
            <span>
              Mở ứng dụng ngân hàng hoặc ví điện tử bất kỳ của bạn (VCB, MB, Techcombank, VPBank,...)
            </span>
          </li>
          <li className="flex items-start gap-3">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-700 text-[11px] font-bold text-white">
              2
            </span>
            <span>
              Chọn tính năng <strong>Quét mã QR</strong> hoặc chuyển khoản nhanh 24/7 với nội dung{" "}
              <strong className="text-orange-600">{order.public_code}</strong>.
            </span>
          </li>
          <li className="flex items-start gap-3">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-700 text-[11px] font-bold text-white">
              3
            </span>
            <span>
              Kiểm tra đúng số tiền <strong>{formatVnd(order.total_vnd)}</strong>, xác thực giao dịch,
              sau đó bấm nút <strong>&quot;Tôi đã chuyển khoản&quot;</strong> bên dưới.
            </span>
          </li>
        </ol>
      </section>

      {/* Hiển thị lỗi nếu có */}
      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-xs font-medium text-red-700">
          {error}
        </div>
      )}

      {/* Nút 'Tôi đã chuyển khoản' CHỈ đặt status='pending_verification' */}
      <div className="pt-2">
        <button
          type="button"
          onClick={handleConfirmTransfer}
          disabled={isSubmitting}
          className="w-full rounded-full bg-emerald-600 py-4 text-center font-black text-white shadow-lg transition hover:bg-emerald-700 disabled:opacity-50"
        >
          {isSubmitting ? "Đang ghi nhận chuyển khoản…" : "Tôi đã chuyển khoản"}
        </button>
        <p className="mt-2 text-center text-[11px] text-slate-500">
          Sau khi bạn bấm, đơn hàng sẽ chuyển sang trạng thái <strong>Chờ đối soát (pending_verification)</strong> để nhân viên quán kiểm tra và chuẩn bị cơm.
        </p>
      </div>
    </div>
  );
}

