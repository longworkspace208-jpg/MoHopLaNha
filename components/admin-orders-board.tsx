"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { OrderRecord, OrderStatus } from "@/lib/types";
import { formatVnd } from "@/lib/format";
import { OrderStatusBadge } from "@/components/order-status-badge";
import { AdminOrderActions } from "@/components/admin-order-actions";

type FilterKey = "all" | "pending_review" | OrderStatus;

const FILTER_TABS: Array<{ key: FilterKey; label: string }> = [
  { key: "all", label: "Tất cả" },
  { key: "pending_review", label: "Chờ xác nhận" },
  { key: "paid", label: "Đã nhận đơn" },
  { key: "cooking", label: "Đang chế biến" },
  { key: "packed", label: "Đã đóng gói" },
  { key: "delivered", label: "Đã giao" },
  { key: "cancelled", label: "Đã hủy" },
];

interface AdminOrdersBoardProps {
  orders: OrderRecord[];
  initialStatus?: string;
}

export function AdminOrdersBoard({ orders, initialStatus }: AdminOrdersBoardProps) {
  const router = useRouter();
  const pathname = usePathname();

  const normalizedInitial: FilterKey =
    initialStatus && FILTER_TABS.some((t) => t.key === initialStatus)
      ? (initialStatus as FilterKey)
      : initialStatus === "pending_verification" || initialStatus === "awaiting_payment"
        ? "pending_review"
        : "all";

  const [activeStatus, setActiveStatus] = useState<FilterKey>(normalizedInitial);

  useEffect(() => {
    setActiveStatus(normalizedInitial);
  }, [normalizedInitial]);

  const handleSelectTab = (tab: FilterKey) => {
    setActiveStatus(tab);
    const base = pathname || "/admin/orders";
    const url = tab === "all" ? base : `${base}?status=${tab}`;
    router.replace(url, { scroll: false });
  };

  // Lọc và sắp xếp: với tab 'Chờ xác nhận', gom awaiting_payment và pending_verification,
  // ưu tiên đưa đơn pending_verification lên đầu!
  let filteredOrders = orders;
  if (activeStatus === "pending_review") {
    filteredOrders = orders
      .filter((o) => o.status === "awaiting_payment" || o.status === "pending_verification")
      .sort((a, b) => {
        if (a.status === "pending_verification" && b.status !== "pending_verification") return -1;
        if (b.status === "pending_verification" && a.status !== "pending_verification") return 1;
        return b.created_at.localeCompare(a.created_at);
      });
  } else if (activeStatus !== "all") {
    filteredOrders = orders.filter((order) => order.status === activeStatus);
  }

  const countByStatus = (statusKey: FilterKey) => {
    if (statusKey === "all") return orders.length;
    if (statusKey === "pending_review") {
      return orders.filter(
        (o) => o.status === "awaiting_payment" || o.status === "pending_verification"
      ).length;
    }
    return orders.filter((o) => o.status === statusKey).length;
  };

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {FILTER_TABS.map((tab) => {
            const isActive = activeStatus === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => handleSelectTab(tab.key)}
                className={`rounded-full px-3.5 py-1.5 text-xs font-bold transition ${
                  isActive
                    ? "bg-forest text-white shadow-sm"
                    : "bg-white text-slate-700 shadow-sm hover:bg-forest/10"
                }`}
              >
                {tab.label} ({countByStatus(tab.key)})
              </button>
            );
          })}
        </div>
        <Link
          href="/admin/orders/facebook"
          className="rounded-xl bg-orange-500 px-3.5 py-2 text-xs font-bold text-white shadow-sm hover:bg-orange-600"
        >
          + Nhập đơn Facebook
        </Link>
      </div>

      <div className="space-y-4">
        {filteredOrders.map((order) => (
          <article
            key={order.id}
            className={`rounded-2xl bg-white p-4 shadow-sm ring-1 transition hover:ring-brand-200 ${
              order.status === "pending_verification"
                ? "border-l-4 border-coral ring-coral/20 bg-coral/5"
                : "ring-slate-100"
            }`}
          >
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="space-y-1.5">
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <Link
                    href={`/admin/orders/${order.id}`}
                    className="font-black text-brand-950 hover:text-brand-700 hover:underline"
                  >
                    #{order.public_code}
                  </Link>
                  <span>·</span>
                  <OrderStatusBadge status={order.status} />
                  <span>·</span>
                  <span className="text-xs text-slate-500">
                    {new Date(order.created_at).toLocaleString("vi-VN")}
                  </span>
                  <span>·</span>
                  <span className="font-bold text-brand-700">
                    {formatVnd(order.total_vnd)}
                  </span>
                  {order.status === "pending_verification" && (
                    <span className="rounded-sm bg-coral px-2 py-0.5 font-mono text-[10px] font-bold text-white">
                      Khách đã báo chuyển
                    </span>
                  )}
                  {order.cancel_reason === "expired" && (
                    <span className="rounded-sm bg-rose-100 px-2 py-0.5 font-mono text-[10px] font-bold text-rose-700">
                      Hết hạn 60p
                    </span>
                  )}
                </div>
                <p className="text-sm font-medium text-slate-800">
                  {order.customer_name} · {order.phone} ·{" "}
                  <span className="font-normal text-slate-600">
                    {order.delivery_address}
                  </span>
                </p>
                <div className="flex flex-wrap gap-3 pt-1 text-xs font-bold text-brand-700">
                  <Link href={`/admin/orders/${order.id}`} className="hover:underline">
                    Chi tiết đơn →
                  </Link>
                  {(order.status === "awaiting_payment" ||
                    order.status === "pending_verification") && (
                    <Link
                      href={`/payment/${order.public_token}`}
                      target="_blank"
                      className="text-amber-700 hover:underline"
                    >
                      Trang thanh toán khách →
                    </Link>
                  )}
                  {order.status === "cooking" && (
                    <Link
                      href={`/admin/orders/${order.id}/pack`}
                      className="text-orange-600 hover:underline"
                    >
                      Cân & đóng gói →
                    </Link>
                  )}
                  {(order.status === "packed" || order.status === "delivered") && (
                    <Link
                      href={`/admin/orders/${order.id}/labels`}
                      className="text-sky-700 hover:underline"
                    >
                      In tem QR →
                    </Link>
                  )}
                </div>
              </div>

              <AdminOrderActions
                id={order.id}
                status={order.status}
                totalVnd={order.total_vnd}
                publicCode={order.public_code}
                cancelReason={order.cancel_reason}
              />
            </div>
          </article>
        ))}

        {filteredOrders.length === 0 && (
          <div className="rounded-2xl bg-white p-8 text-center text-sm text-slate-500 shadow-sm">
            Không có đơn hàng nào trong trạng thái này.
          </div>
        )}
      </div>
    </div>
  );
}
