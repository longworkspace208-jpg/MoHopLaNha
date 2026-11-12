"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { OrderRecord, OrderStatus } from "@/lib/types";
import { formatVnd } from "@/lib/format";
import { OrderStatusBadge } from "@/components/order-status-badge";
import { AdminOrderActions } from "@/components/admin-order-actions";

const FILTER_TABS: Array<{ key: "all" | OrderStatus; label: string }> = [
  { key: "all", label: "Tất cả" },
  { key: "awaiting_payment", label: "awaiting_payment" },
  { key: "pending_verification", label: "pending_verification" },
  { key: "paid", label: "paid" },
  { key: "cooking", label: "cooking" },
  { key: "packed", label: "packed" },
  { key: "delivered", label: "delivered" },
  { key: "cancelled", label: "cancelled" },
];

interface AdminOrdersBoardProps {
  orders: OrderRecord[];
  initialStatus?: string;
}

export function AdminOrdersBoard({ orders, initialStatus }: AdminOrdersBoardProps) {
  const router = useRouter();
  const pathname = usePathname();
  const normalizedInitial =
    initialStatus && FILTER_TABS.some((t) => t.key === initialStatus)
      ? (initialStatus as "all" | OrderStatus)
      : "all";

  const [activeStatus, setActiveStatus] = useState<"all" | OrderStatus>(normalizedInitial);

  useEffect(() => {
    setActiveStatus(normalizedInitial);
  }, [normalizedInitial]);

  const handleSelectTab = (tab: "all" | OrderStatus) => {
    setActiveStatus(tab);
    const base = pathname || "/admin";
    const url = tab === "all" ? base : `${base}?status=${tab}`;
    router.replace(url, { scroll: false });
  };

  const filteredOrders =
    activeStatus === "all"
      ? orders
      : orders.filter((order) => order.status === activeStatus);

  const countByStatus = (status: "all" | OrderStatus) =>
    status === "all"
      ? orders.length
      : orders.filter((o) => o.status === status).length;

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
                    ? "bg-brand-950 text-white shadow-sm"
                    : "bg-white text-slate-700 shadow-sm hover:bg-brand-50"
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
            className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100 transition hover:ring-brand-200"
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
                  {order.status === "awaiting_payment" && (
                    <Link
                      href={`/payment/${order.id}`}
                      className="text-amber-700 hover:underline"
                    >
                      Link thanh toán VietQR →
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

              <AdminOrderActions id={order.id} status={order.status} />
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
