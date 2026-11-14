"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { OrderStatus } from "@/lib/types";
import { formatVnd } from "@/lib/format";

interface AdminOrderActionsProps {
  id: string;
  status: OrderStatus;
  totalVnd?: number;
  publicCode?: string;
  cancelReason?: string | null;
  onStatusChange?: () => void;
}

export function AdminOrderActions({
  id,
  status,
  totalVnd,
  publicCode,
  cancelReason,
  onStatusChange,
}: AdminOrderActionsProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showRestoreModal, setShowRestoreModal] = useState(false);

  const isPendingPayment =
    status === "awaiting_payment" || status === "pending_verification";
  const isExpiredCancelled = status === "cancelled" && cancelReason === "expired";

  const handleConfirmPayment = async (restoreExpired = false) => {
    setLoading(true);
    setMessage("");
    setIsError(false);

    try {
      const res = await fetch(`/api/admin/orders/${id}/confirm-payment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ restoreExpired }),
      });
      const data = await res.json();

      if (res.ok) {
        setShowConfirmModal(false);
        setShowRestoreModal(false);
        setMessage("✓ Đã nhận tiền, đơn chuyển sang Đang chuẩn bị.");
        onStatusChange?.();
        router.refresh();
      } else {
        setIsError(true);
        setMessage(
          data.error ?? "Đơn hàng đã được thay đổi trạng thái trước đó (409 Conflict)."
        );
      }
    } catch {
      setIsError(true);
      setMessage("Lỗi kết nối máy chủ khi xác nhận thanh toán.");
    } finally {
      setLoading(false);
    }
  };

  const handleNextStatus = async (nextStatus: OrderStatus, label: string) => {
    setLoading(true);
    setMessage("");
    setIsError(false);

    try {
      const res = await fetch(`/api/admin/orders/${id}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus, newStatus: nextStatus }),
      });
      const data = await res.json();

      if (res.ok) {
        setMessage(`✓ Đã chuyển sang ${label}.`);
        onStatusChange?.();
        router.refresh();
      } else {
        setIsError(true);
        setMessage(data.error ?? "Không thể cập nhật trạng thái.");
      }
    } catch {
      setIsError(true);
      setMessage("Lỗi kết nối máy chủ.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-end gap-1.5">
      {/* 1. Đơn chờ xác nhận thanh toán (awaiting_payment & pending_verification) */}
      {isPendingPayment && (
        <button
          type="button"
          onClick={() => setShowConfirmModal(true)}
          disabled={loading}
          className="rounded-xl bg-coral px-4 py-2 font-mono text-xs font-bold uppercase tracking-wider text-white shadow-sm transition hover:bg-coral-hover active:scale-[0.98] disabled:opacity-50"
        >
          {loading ? "Đang xử lý…" : "Đã nhận tiền, bắt đầu chuẩn bị"}
        </button>
      )}

      {/* 2. Đơn hết hạn có thể khôi phục */}
      {isExpiredCancelled && (
        <button
          type="button"
          onClick={() => setShowRestoreModal(true)}
          disabled={loading}
          className="rounded-xl border-2 border-amber-600 bg-amber-50 px-3.5 py-2 font-mono text-xs font-bold uppercase tracking-wider text-amber-800 shadow-sm transition hover:bg-amber-100 disabled:opacity-50"
        >
          {loading ? "Đang xử lý…" : "Khôi phục và xác nhận đã nhận tiền"}
        </button>
      )}

      {/* 3. Đơn đã thanh toán -> Chế biến */}
      {status === "paid" && (
        <button
          type="button"
          onClick={() => handleNextStatus("cooking", "Chế biến")}
          disabled={loading}
          className="rounded-xl bg-forest px-4 py-2 font-mono text-xs font-bold uppercase tracking-wider text-white shadow-sm transition hover:bg-forest/90 disabled:opacity-50"
        >
          {loading ? "Đang xử lý…" : "Bắt đầu nấu (Chế biến)"}
        </button>
      )}

      {/* 4. Đơn đã đóng gói -> Đã giao */}
      {status === "packed" && (
        <button
          type="button"
          onClick={() => handleNextStatus("delivered", "Đã giao")}
          disabled={loading}
          className="rounded-xl bg-forest px-4 py-2 font-mono text-xs font-bold uppercase tracking-wider text-white shadow-sm transition hover:bg-forest/90 disabled:opacity-50"
        >
          {loading ? "Đang xử lý…" : "Xác nhận đã giao"}
        </button>
      )}

      {message && (
        <small
          className={`text-xs font-medium ${
            isError ? "text-rose-600" : "text-emerald-700"
          }`}
        >
          {message}
        </small>
      )}

      {/* MODAL HỘP THOẠI ĐỐI SOÁT & XÁC NHẬN TIỀN CHO ADMIN */}
      {showConfirmModal && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs"
        >
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl ring-1 ring-slate-900/10">
            <div className="flex items-center justify-between border-b border-rule pb-3">
              <h3 className="font-display text-lg font-bold text-forest">
                Đối Soát &amp; Xác Nhận Nhận Tiền
              </h3>
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                className="font-mono text-sm font-bold text-muted hover:text-ink"
              >
                ✕
              </button>
            </div>

            <p className="mt-3 text-xs leading-relaxed text-slate-600">
              Vui lòng mở ứng dụng ngân hàng và kiểm tra kỹ biến động số dư khớp đúng với thông tin dưới đây:
            </p>

            <div className="mt-4 space-y-3 rounded-xl border border-rule bg-ivory/50 p-4">
              <div>
                <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-muted">
                  Số tiền cần đối chiếu
                </span>
                <p className="mt-0.5 font-display text-2xl font-black text-coral">
                  {totalVnd ? formatVnd(totalVnd) : "—"}
                </p>
              </div>

              <div>
                <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-muted">
                  Nội dung chuyển khoản cần đối chiếu
                </span>
                <p className="mt-0.5 font-mono text-xl font-black text-forest">
                  #{publicCode || id}
                </p>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                disabled={loading}
                className="rounded-xl border border-slate-300 px-4 py-2 font-mono text-xs font-bold uppercase tracking-wider text-slate-700 hover:bg-slate-100"
              >
                Hủy bỏ
              </button>

              <button
                type="button"
                onClick={() => handleConfirmPayment(false)}
                disabled={loading}
                className="rounded-xl bg-coral px-5 py-2 font-mono text-xs font-bold uppercase tracking-wider text-white shadow-sm hover:bg-coral-hover disabled:opacity-50"
              >
                {loading ? "Đang xác nhận…" : "Xác nhận đã nhận tiền"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL KHÔI PHỤC ĐƠN HẾT HẠN */}
      {showRestoreModal && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs"
        >
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl ring-1 ring-slate-900/10">
            <div className="flex items-center justify-between border-b border-rule pb-3">
              <h3 className="font-display text-lg font-bold text-amber-900">
                Khôi Phục Đơn Hết Hạn &amp; Xác Nhận Tiền
              </h3>
              <button
                type="button"
                onClick={() => setShowRestoreModal(false)}
                className="font-mono text-sm font-bold text-muted hover:text-ink"
              >
                ✕
              </button>
            </div>

            <p className="mt-3 text-xs leading-relaxed text-slate-600">
              Đơn hàng này trước đó đã bị tự động hủy do quá thời hạn 60 phút. Khách hàng đã chuyển khoản trễ. Vui lòng đối chiếu sao kê tài khoản ngân hàng:
            </p>

            <div className="mt-4 space-y-3 rounded-xl border border-amber-200 bg-amber-50/50 p-4">
              <div>
                <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-amber-800">
                  Số tiền cần đối chiếu
                </span>
                <p className="mt-0.5 font-display text-2xl font-black text-coral">
                  {totalVnd ? formatVnd(totalVnd) : "—"}
                </p>
              </div>

              <div>
                <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-amber-800">
                  Nội dung chuyển khoản
                </span>
                <p className="mt-0.5 font-mono text-xl font-black text-forest">
                  #{publicCode || id}
                </p>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowRestoreModal(false)}
                disabled={loading}
                className="rounded-xl border border-slate-300 px-4 py-2 font-mono text-xs font-bold uppercase tracking-wider text-slate-700 hover:bg-slate-100"
              >
                Đóng
              </button>

              <button
                type="button"
                onClick={() => handleConfirmPayment(true)}
                disabled={loading}
                className="rounded-xl bg-amber-600 px-5 py-2 font-mono text-xs font-bold uppercase tracking-wider text-white shadow-sm hover:bg-amber-700 disabled:opacity-50"
              >
                {loading ? "Đang xử lý…" : "Khôi phục & Xác nhận tiền"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
