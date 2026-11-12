"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { OrderStatus } from "@/lib/types";

interface AdminOrderActionsProps {
  id: string;
  status: OrderStatus;
  onStatusChange?: () => void;
}

const STATUS_LABEL: Partial<Record<OrderStatus, string>> = {
  pending_verification: "Xác nhận đã nhận tiền",
  paid: "Chuyển sang Chế biến",
  packed: "Đã giao",
};

const NEXT_STATUS: Partial<Record<OrderStatus, OrderStatus>> = {
  pending_verification: "paid",
  paid: "cooking",
  packed: "delivered",
};

export function AdminOrderActions({ id, status, onStatusChange }: AdminOrderActionsProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);

  const label = STATUS_LABEL[status];
  const nextStatus = NEXT_STATUS[status];

  if (!label || !nextStatus) return null;

  const handleClick = async () => {
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
        setMessage("✓ Đã cập nhật trạng thái.");
        onStatusChange?.();
        router.refresh();
      } else {
        setIsError(true);
        setMessage(data.error ?? "Lỗi không xác định.");
      }
    } catch {
      setIsError(true);
      setMessage("Lỗi kết nối máy chủ.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={handleClick}
        disabled={loading}
        className="rounded-xl bg-brand-700 px-3.5 py-2 text-sm font-bold text-white shadow-sm hover:bg-brand-950 disabled:opacity-50"
      >
        {loading ? "Đang xử lý…" : label}
      </button>
      {message && (
        <small className={`text-xs font-medium ${isError ? "text-rose-600" : "text-emerald-700"}`}>
          {message}
        </small>
      )}
    </div>
  );
}
