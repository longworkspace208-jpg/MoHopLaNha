"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { formatVnd } from "@/lib/format";

type TrackedOrder = {
  publicToken: string;
  publicCode: string;
  status: string;
  statusLabel: string;
  customerName: string;
  phone: string;
  deliveryAddress: string;
  totalVnd: number;
  createdAt: string;
  expiresAt?: string;
  itemsCount: number;
  itemSummary: string;
  trackingUrl: string;
  paymentUrl: string;
};

type StoredLocalOrder = {
  publicToken: string;
  publicCode: string;
  customerName?: string;
  createdAt?: string;
};

export function OrderTracker() {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [searched, setSearched] = useState(false);
  const [searchResults, setSearchResults] = useState<TrackedOrder[]>([]);
  const [localOrders, setLocalOrders] = useState<TrackedOrder[]>([]);
  const [loadingLocal, setLoadingLocal] = useState(true);

  // 1. Tải danh sách đơn hàng đã lưu trên thiết bị
  useEffect(() => {
    async function loadLocalOrders() {
      try {
        const raw = localStorage.getItem("mhln_my_orders");
        if (!raw) {
          setLoadingLocal(false);
          return;
        }

        const parsed: StoredLocalOrder[] = JSON.parse(raw);
        if (!Array.isArray(parsed) || parsed.length === 0) {
          setLoadingLocal(false);
          return;
        }

        // Lấy thông tin trạng thái mới nhất của các đơn này
        const results: TrackedOrder[] = [];
        for (const item of parsed.slice(0, 5)) {
          if (!item.publicToken) continue;
          try {
            const res = await fetch(`/api/orders/${item.publicToken}/status`);
            if (res.ok) {
              const data = await res.json();
              results.push({
                publicToken: item.publicToken,
                publicCode: data.code || item.publicCode,
                status: data.status,
                statusLabel: data.label,
                customerName: item.customerName || "Khách hàng",
                phone: "",
                deliveryAddress: "",
                totalVnd: 0,
                createdAt: item.createdAt || "",
                itemsCount: 0,
                itemSummary: "Đơn hàng của bạn",
                trackingUrl: `/orders/${item.publicToken}`,
                paymentUrl: `/payment/${item.publicToken}`,
              });
            }
          } catch {
            // bỏ qua lỗi fetch từng đơn
          }
        }
        setLocalOrders(results);
      } catch (err) {
        console.warn("Lỗi đọc đơn local:", err);
      } finally {
        setLoadingLocal(false);
      }
    }

    loadLocalOrders();
  }, []);

  // 2. Tra cứu đơn hàng theo SĐT hoặc mã đơn
  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    const clean = query.trim();
    if (!clean || clean.length < 3) {
      setError("Vui lòng nhập tối thiểu 3 ký tự (Số điện thoại hoặc mã MHLN).");
      return;
    }

    setLoading(true);
    setError("");
    setSearched(true);

    try {
      const res = await fetch("/api/orders/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: clean }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Không thể tra cứu đơn hàng.");
      }

      setSearchResults(data.orders || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Đã xảy ra lỗi khi tra cứu.");
      setSearchResults([]);
    } finally {
      setLoading(false);
    }
  }

  function getStatusBadge(status: string, label: string) {
    switch (status) {
      case "awaiting_payment":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 font-mono text-xs font-bold text-amber-800">
            <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
            {label}
          </span>
        );
      case "pending_verification":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-sky-100 px-3 py-1 font-mono text-xs font-bold text-sky-800">
            <span className="h-2 w-2 rounded-full bg-sky-500" />
            {label}
          </span>
        );
      case "paid":
      case "cooking":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 font-mono text-xs font-bold text-emerald-800">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            {label}
          </span>
        );
      case "packed":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-100 px-3 py-1 font-mono text-xs font-bold text-indigo-800">
            <span className="h-2 w-2 rounded-full bg-indigo-500" />
            {label}
          </span>
        );
      case "delivered":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 font-mono text-xs font-bold text-slate-700">
            <span className="h-2 w-2 rounded-full bg-slate-400" />
            {label}
          </span>
        );
      case "cancelled":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-red-100 px-3 py-1 font-mono text-xs font-bold text-red-800">
            <span className="h-2 w-2 rounded-full bg-red-500" />
            {label}
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 font-mono text-xs font-bold text-slate-700">
            {label}
          </span>
        );
    }
  }

  function formatVietnamTime(iso: string) {
    if (!iso) return "";
    try {
      return new Intl.DateTimeFormat("vi-VN", {
        timeZone: "Asia/Ho_Chi_Minh",
        hour: "2-digit",
        minute: "2-digit",
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      }).format(new Date(iso));
    } catch {
      return iso;
    }
  }

  return (
    <div className="space-y-12">
      {/* KHUNG TÌM KIẾM ĐƠN HÀNG */}
      <section className="rounded-xl border border-rule bg-white p-6 shadow-sm sm:p-8">
        <h2 className="font-display text-xl font-bold text-forest sm:text-2xl">
          Tra cứu đơn hàng
        </h2>
        <p className="mt-1 text-sm text-muted">
          Nhập số điện thoại người nhận (ví dụ <code>0912345678</code>) hoặc mã đơn hàng (ví dụ <code>MHLN1234</code>) để theo dõi tiến trình bếp nấu và giao cơm.
        </p>

        <form onSubmit={handleSearch} className="mt-6 flex flex-col gap-3 sm:flex-row">
          <input
            type="text"
            required
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Số điện thoại hoặc mã đơn MHLN..."
            className="flex-1 rounded-lg border border-rule bg-ivory/30 px-4 py-3 font-mono text-sm text-ink outline-none transition-colors focus:border-forest focus:bg-white"
          />
          <button
            type="submit"
            disabled={loading}
            className="flex items-center justify-center gap-2 rounded-lg bg-forest px-6 py-3 font-mono text-xs font-bold uppercase tracking-[0.14em] text-white transition-all hover:bg-forest/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest disabled:opacity-50"
          >
            {loading ? (
              <span>Đang tra cứu…</span>
            ) : (
              <>
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <span>Tra cứu</span>
              </>
            )}
          </button>
        </form>

        {error && (
          <p className="mt-3 text-xs font-medium text-red-600" role="alert">
            {error}
          </p>
        )}
      </section>

      {/* KẾT QUẢ TÌM KIẾM */}
      {searched && (
        <section className="space-y-4">
          <div className="flex items-center justify-between border-b border-rule pb-3">
            <h3 className="font-display text-lg font-bold text-forest">
              Kết quả tra cứu ({searchResults.length} đơn)
            </h3>
            <span className="font-mono text-xs text-muted">
              Từ khóa: &quot;{query}&quot;
            </span>
          </div>

          {searchResults.length === 0 ? (
            <div className="rounded-xl border border-dashed border-rule bg-white p-8 text-center">
              <p className="font-display text-base font-semibold text-ink">
                Không tìm thấy đơn hàng nào phù hợp
              </p>
              <p className="mt-1 text-xs text-muted">
                Vui lòng kiểm tra lại số điện thoại hoặc mã đơn (MHLN####). Bạn cũng có thể liên hệ trực tiếp với bếp qua Zalo/Facebook nếu cần trợ giúp.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {searchResults.map((order) => (
                <article
                  key={order.publicToken}
                  className="rounded-xl border border-rule bg-white p-5 shadow-sm transition-shadow hover:shadow-md sm:p-6"
                >
                  <div className="flex flex-wrap items-start justify-between gap-4 border-b border-rule pb-4">
                    <div>
                      <div className="flex items-baseline gap-3">
                        <span className="font-mono text-lg font-black tracking-wider text-forest">
                          #{order.publicCode}
                        </span>
                        {getStatusBadge(order.status, order.statusLabel)}
                      </div>
                      <p className="mt-1 font-mono text-xs text-muted">
                        Đặt lúc: {formatVietnamTime(order.createdAt)}
                      </p>
                    </div>

                    <div className="text-right">
                      <span className="font-mono text-xs text-muted">Tổng thanh toán</span>
                      <p className="font-mono text-xl font-bold text-coral">
                        {formatVnd(order.totalVnd)}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3 text-xs sm:grid-cols-2">
                    <div>
                      <span className="font-semibold text-muted">Món ăn trong đơn:</span>
                      <p className="mt-0.5 font-medium text-ink">
                        {order.itemSummary || `${order.itemsCount} món ăn`}
                      </p>
                    </div>
                    <div>
                      <span className="font-semibold text-muted">Giao đến:</span>
                      <p className="mt-0.5 text-ink">
                        {order.deliveryAddress || "Địa chỉ bảo mật"}
                      </p>
                    </div>
                  </div>

                  <div className="mt-5 flex flex-wrap items-center justify-end gap-3 border-t border-rule pt-4">
                    {order.status === "awaiting_payment" && (
                      <Link
                        href={order.paymentUrl}
                        className="rounded-lg bg-coral px-4 py-2 font-mono text-xs font-bold uppercase tracking-wider text-white shadow-sm transition-all hover:bg-coral-hover hover:shadow"
                      >
                        Chuyển khoản ngay →
                      </Link>
                    )}
                    <Link
                      href={order.trackingUrl}
                      className="rounded-lg border border-forest px-4 py-2 font-mono text-xs font-bold uppercase tracking-wider text-forest transition-colors hover:bg-forest hover:text-white"
                    >
                      Theo dõi tiến trình 5 bước →
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      )}

      {/* ĐƠN HÀNG GẦN ĐÂY TRÊN THIẾT BỊ NÀY */}
      <section className="space-y-4">
        <div className="flex items-center justify-between border-b border-rule pb-3">
          <h3 className="font-display text-lg font-bold text-forest">
            Đơn hàng gần đây trên thiết bị này
          </h3>
          <span className="font-mono text-xs text-muted">
            Tự động ghi nhớ các đơn bạn vừa đặt
          </span>
        </div>

        {loadingLocal ? (
          <div className="rounded-xl bg-white p-6 text-center font-mono text-xs text-muted">
            Đang tải dữ liệu đơn hàng…
          </div>
        ) : localOrders.length === 0 ? (
          <div className="rounded-xl border border-dashed border-rule bg-white p-8 text-center">
            <p className="font-display text-base font-semibold text-ink">
              Chưa có đơn hàng nào được lưu trên trình duyệt này
            </p>
            <p className="mt-1 text-xs text-muted">
              Sau khi bạn đặt cơm thành công, đơn hàng sẽ tự động xuất hiện tại đây để tiện theo dõi bất cứ lúc nào.
            </p>
            <Link
              href="/menu"
              className="mt-4 inline-block font-mono text-xs font-bold uppercase tracking-wider text-coral underline hover:text-coral-hover"
            >
              ← Xem thực đơn hôm nay
            </Link>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {localOrders.map((order) => (
              <article
                key={order.publicToken}
                className="flex flex-col justify-between rounded-xl border border-rule bg-white p-5 shadow-sm transition-all hover:border-forest/40 hover:shadow-md"
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-base font-bold text-forest">
                      #{order.publicCode}
                    </span>
                    {getStatusBadge(order.status, order.statusLabel)}
                  </div>
                  {order.createdAt && (
                    <p className="mt-1 font-mono text-[11px] text-muted">
                      {formatVietnamTime(order.createdAt)}
                    </p>
                  )}
                </div>

                <div className="mt-5 flex items-center justify-between gap-2 border-t border-rule pt-4">
                  {order.status === "awaiting_payment" ? (
                    <Link
                      href={order.paymentUrl}
                      className="font-mono text-xs font-bold text-coral underline hover:text-coral-hover"
                    >
                      Thanh toán ngay →
                    </Link>
                  ) : (
                    <span className="font-mono text-[11px] text-muted">Bếp đang phục vụ</span>
                  )}

                  <Link
                    href={order.trackingUrl}
                    className="rounded-lg bg-forest/5 px-3 py-1.5 font-mono text-xs font-bold text-forest transition-colors hover:bg-forest hover:text-white"
                  >
                    Xem tiến trình →
                  </Link>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
