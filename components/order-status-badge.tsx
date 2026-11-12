import type { OrderStatus } from "@/lib/types";

export const ORDER_STATUS_META: Record<
  OrderStatus,
  { label: string; badgeClass: string }
> = {
  awaiting_payment: {
    label: "Chờ thanh toán",
    badgeClass: "bg-slate-100 text-slate-700",
  },
  pending_verification: {
    label: "Chờ đối soát",
    badgeClass: "bg-amber-100 text-amber-800",
  },
  paid: {
    label: "Đã thanh toán",
    badgeClass: "bg-emerald-100 text-emerald-800",
  },
  cooking: {
    label: "Đang chế biến",
    badgeClass: "bg-orange-100 text-orange-800",
  },
  packed: {
    label: "Đã đóng gói",
    badgeClass: "bg-sky-100 text-sky-800",
  },
  delivered: {
    label: "Đã giao",
    badgeClass: "bg-brand-100 text-brand-700",
  },
  cancelled: {
    label: "Đã hủy",
    badgeClass: "bg-rose-100 text-rose-700",
  },
};

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  const meta = ORDER_STATUS_META[status] ?? {
    label: status,
    badgeClass: "bg-slate-100 text-slate-700",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold ${meta.badgeClass}`}
    >
      {meta.label}
    </span>
  );
}
