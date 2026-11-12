import { notFound } from "next/navigation";
import Link from "next/link";
import { getOrderByCode } from "@/lib/orders-db";
import { formatVnd } from "@/lib/format";
import type { OrderStatus } from "@/lib/types";

export const dynamic = "force-dynamic";

const STATUS_CONFIG: Record<
  OrderStatus,
  { label: string; badgeClass: string; description: string; step: number }
> = {
  awaiting_payment: {
    label: "Chờ thanh toán",
    badgeClass: "bg-amber-100 text-amber-900 border-amber-300",
    description: "Đơn hàng đang chờ bạn quét mã VietQR để thanh toán.",
    step: 1
  },
  pending_verification: {
    label: "Đang đối soát chuyển khoản",
    badgeClass: "bg-sky-100 text-sky-900 border-sky-300",
    description:
      "Chúng mình đã nhận thông báo bạn đã chuyển khoản và đang đối soát sao kê ngân hàng. Cơm sẽ được bắt đầu làm ngay sau khi tiền khớp!",
    step: 2
  },
  paid: {
    label: "Đã xác nhận thanh toán",
    badgeClass: "bg-emerald-100 text-emerald-900 border-emerald-300",
    description: "Đơn hàng đã được xác nhận thanh toán thành công và đang chờ bếp chuẩn bị.",
    step: 3
  },
  cooking: {
    label: "Đang chế biến",
    badgeClass: "bg-orange-100 text-orange-900 border-orange-300",
    description: "Bếp đang chế biến phần ăn tươi mới theo đúng định lượng dinh dưỡng của bạn.",
    step: 3
  },
  packed: {
    label: "Đã đóng gói",
    badgeClass: "bg-indigo-100 text-indigo-900 border-indigo-300",
    description: "Phần ăn đã được cân định lượng, dán tem QR truy xuất và sẵn sàng giao.",
    step: 3
  },
  delivered: {
    label: "Đã giao hàng",
    badgeClass: "bg-emerald-100 text-emerald-900 border-emerald-300",
    description: "Đơn hàng đã được giao thành công. Chúc bạn ngon miệng!",
    step: 3
  },
  cancelled: {
    label: "Đã hủy",
    badgeClass: "bg-rose-100 text-rose-900 border-rose-300",
    description: "Đơn hàng đã bị hủy.",
    step: 0
  }
};

export default async function OrderStatusPage({
  params
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const order = await getOrderByCode(code);

  if (!order) {
    notFound();
  }

  const currentStatusInfo = STATUS_CONFIG[order.status] ?? STATUS_CONFIG.awaiting_payment;

  return (
    <main className="mx-auto min-h-screen max-w-lg px-4 pb-16 pt-6">
      {/* Tiêu đề & Mã đơn */}
      <div className="flex items-center justify-between">
        <div>
          <span className="text-xs font-semibold text-slate-500">Mã đơn hàng</span>
          <h1 className="text-2xl font-black text-brand-950">#{order.public_code}</h1>
        </div>
        <span
          className={`rounded-full border px-3 py-1 text-xs font-bold ${currentStatusInfo.badgeClass}`}
        >
          {currentStatusInfo.label}
        </span>
      </div>

      {/* Thông báo tiến độ trạng thái */}
      <section className="mt-4 rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-bold text-brand-950">Tiến độ đơn hàng</h2>

        {/* Timeline */}
        <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs">
          <div className="space-y-1">
            <div className="mx-auto flex h-7 w-7 items-center justify-center rounded-full bg-emerald-600 text-xs font-black text-white">
              ✓
            </div>
            <span className="block font-bold text-slate-800">Đặt đơn</span>
          </div>

          <div className="space-y-1">
            <div
              className={`mx-auto flex h-7 w-7 items-center justify-center rounded-full text-xs font-black text-white ${
                order.status === "awaiting_payment"
                  ? "bg-amber-500 animate-pulse"
                  : "bg-emerald-600"
              }`}
            >
              {order.status === "awaiting_payment" ? "2" : "✓"}
            </div>
            <span className="block font-bold text-slate-800">Chuyển khoản</span>
          </div>

          <div className="space-y-1">
            <div
              className={`mx-auto flex h-7 w-7 items-center justify-center rounded-full text-xs font-black text-white ${
                ["paid", "cooking", "packed", "delivered"].includes(order.status)
                  ? "bg-emerald-600"
                  : order.status === "pending_verification"
                    ? "bg-sky-600 animate-pulse"
                    : order.status === "cancelled"
                      ? "bg-rose-500"
                      : "bg-slate-300"
              }`}
            >
              {order.status === "delivered"
                ? "✓"
                : order.status === "cancelled"
                  ? "✕"
                  : "3"}
            </div>
            <span className="block font-bold text-slate-800">Chế biến & Giao</span>
          </div>
        </div>

        {/* Giải thích chi tiết trạng thái */}
        <div className="mt-5 rounded-2xl bg-slate-50 p-3.5 text-xs text-slate-700">
          <p className="font-semibold text-brand-950">{currentStatusInfo.description}</p>
          {order.status === "awaiting_payment" && (
            <Link
              href={`/payment/${order.id}`}
              className="mt-3 inline-block rounded-full bg-orange-500 px-4 py-2 font-bold text-white shadow-xs hover:bg-orange-600"
            >
              Mở trang quét mã VietQR →
            </Link>
          )}
        </div>
      </section>

      {/* Thông tin giao hàng */}
      <section className="mt-4 space-y-2 rounded-3xl bg-white p-5 shadow-sm">
        <h2 className="text-sm font-bold text-brand-950">Địa chỉ nhận cơm</h2>
        <div className="space-y-1 text-xs text-slate-600">
          <p>
            <strong className="text-slate-800">{order.customer_name}</strong> · {order.phone}
          </p>
          <p>{order.delivery_address}</p>
          {order.customer_email && (
            <p className="text-slate-500">Email: {order.customer_email}</p>
          )}
          {order.note && (
            <p className="rounded-lg bg-amber-50 p-2 text-amber-900">
              Ghi chú: {order.note}
            </p>
          )}
        </div>
      </section>

      {/* Chi tiết món ăn & gram */}
      <section className="mt-4 space-y-3 rounded-3xl bg-white p-5 shadow-sm">
        <h2 className="text-sm font-bold text-brand-950">Món ăn trong đơn</h2>
        <div className="divide-y divide-slate-100">
          {order.items.map((item, idx) => (
            <article key={idx} className="py-2.5">
              <div className="flex items-center justify-between text-xs">
                <div>
                  <strong className="text-slate-800">{item.name}</strong>
                  <span className="ml-2 font-semibold text-slate-500">
                    ({item.grams}g)
                  </span>
                </div>
                <span className="font-bold text-brand-700">
                  {formatVnd(item.unitPrice)}
                </span>
              </div>
              <div className="mt-1 flex gap-2 text-[10px] text-slate-400">
                <span>{Math.round(item.nutrition.kcal)} kcal</span>
                <span>· P {item.nutrition.protein.toFixed(1)}g</span>
                <span>· C {item.nutrition.carbs.toFixed(1)}g</span>
                <span>· F {item.nutrition.fat.toFixed(1)}g</span>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* Dinh dưỡng snapshot */}
      <section className="mt-4 rounded-3xl bg-brand-50 p-4 text-brand-950">
        <h3 className="text-xs font-bold uppercase tracking-wider text-brand-700">
          Dinh dưỡng tổng thể (Snapshot bất biến)
        </h3>
        <div className="mt-2 grid grid-cols-2 gap-2 text-center text-xs sm:grid-cols-4">
          <div className="rounded-xl bg-white p-2 shadow-xs">
            <span className="block text-[11px] text-slate-500">Năng lượng</span>
            <strong className="text-xs font-black text-brand-950">
              {Math.round(order.nutrition_snapshot.kcal)} kcal
            </strong>
          </div>
          <div className="rounded-xl bg-white p-2 shadow-xs">
            <span className="block text-[11px] text-slate-500">Protein</span>
            <strong className="text-xs font-black text-emerald-700">
              {order.nutrition_snapshot.protein.toFixed(1)}g
            </strong>
          </div>
          <div className="rounded-xl bg-white p-2 shadow-xs">
            <span className="block text-[11px] text-slate-500">Carbs</span>
            <strong className="text-xs font-black text-amber-800">
              {order.nutrition_snapshot.carbs.toFixed(1)}g
            </strong>
          </div>
          <div className="rounded-xl bg-white p-2 shadow-xs">
            <span className="block text-[11px] text-slate-500">Fat</span>
            <strong className="text-xs font-black text-blue-700">
              {order.nutrition_snapshot.fat.toFixed(1)}g
            </strong>
          </div>
        </div>
      </section>

      {/* Tổng kết tiền */}
      <section className="mt-4 space-y-2 rounded-3xl bg-white p-5 shadow-sm text-xs">
        <div className="flex justify-between text-slate-600">
          <span>Tạm tính món ăn</span>
          <span className="font-semibold">{formatVnd(order.subtotal_vnd)}</span>
        </div>
        <div className="flex justify-between text-slate-600">
          <span>Phí giao hàng</span>
          <span className="font-semibold">{formatVnd(order.shipping_fee_vnd)}</span>
        </div>
        <div className="flex justify-between border-t border-slate-100 pt-2 text-sm font-black text-brand-950">
          <span>Tổng thanh toán</span>
          <span className="text-base text-orange-600">{formatVnd(order.total_vnd)}</span>
        </div>
      </section>

      {/* Điều hướng về trang chủ */}
      <div className="mt-6 text-center">
        <Link
          href="/"
          className="inline-block rounded-full bg-brand-50 px-6 py-3 text-xs font-bold text-brand-800 transition hover:bg-brand-100"
        >
          ← Quay về trang chủ Mở Hộp Là Nhà
        </Link>
      </div>
    </main>
  );
}

