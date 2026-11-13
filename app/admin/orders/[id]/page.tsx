import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { isAdmin } from "@/lib/admin-auth";
import { getOrderById, getPortionsByOrder } from "@/lib/orders-db";
import { formatVnd } from "@/lib/format";
import { AdminNav } from "@/components/admin-nav";
import { OrderStatusBadge } from "@/components/order-status-badge";
import { AdminOrderActions } from "@/components/admin-order-actions";

export const dynamic = "force-dynamic";

export default async function AdminOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  if (!(await isAdmin())) {
    redirect("/admin/login");
  }

  const { id } = await params;
  const order = await getOrderById(id);

  if (!order) {
    notFound();
  }

  const showPortions = order.status === "packed" || order.status === "delivered";
  const portions = showPortions ? await getPortionsByOrder(order.id) : [];

  return (
    <main className="mx-auto max-w-4xl p-5">
      <AdminNav active="orders" />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/admin/orders"
          className="text-sm font-bold text-brand-700 hover:underline"
        >
          ← Quay lại danh sách đơn hàng
        </Link>

        <div className="flex flex-wrap gap-2">
          <Link
            href={`/admin/orders/${order.id}/pack`}
            className="rounded-xl bg-orange-500 px-3.5 py-2 text-sm font-bold text-white shadow-sm hover:bg-orange-600"
          >
            Đóng gói & cân khẩu phần
          </Link>
          <Link
            href={`/admin/orders/${order.id}/labels`}
            className="rounded-xl bg-white px-3.5 py-2 text-sm font-bold text-brand-700 shadow-sm ring-1 ring-brand-200 hover:bg-brand-50"
          >
            In tem QR
          </Link>
        </div>
      </div>

      <section className="rounded-2xl bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-2xl font-black text-brand-950">
                Đơn #{order.public_code}
              </h1>
              <OrderStatusBadge status={order.status} />
            </div>
            <p className="mt-1 text-xs text-slate-500">
              ID: {order.id} · Tạo lúc:{" "}
              {new Date(order.created_at).toLocaleString("vi-VN")}
            </p>
          </div>
          <AdminOrderActions id={order.id} status={order.status} />
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5 text-sm">
            <h2 className="font-bold text-brand-950">Thông tin khách hàng</h2>
            <p>
              <span className="text-slate-500">Họ tên:</span>{" "}
              <strong>{order.customer_name}</strong>
            </p>
            <p>
              <span className="text-slate-500">Điện thoại:</span>{" "}
              <strong>{order.phone}</strong>
            </p>
            <p>
              <span className="text-slate-500">Email:</span>{" "}
              {order.customer_email || "—"}
            </p>
            <p>
              <span className="text-slate-500">Địa chỉ giao:</span>{" "}
              {order.delivery_address}
            </p>
            <p>
              <span className="text-slate-500">Ghi chú:</span>{" "}
              {order.note || "—"}
            </p>
          </div>

          <div className="space-y-1.5 text-sm">
            <h2 className="font-bold text-brand-950">Thanh toán & Mốc thời gian</h2>
            <p>
              <span className="text-slate-500">Tạm tính:</span>{" "}
              {formatVnd(order.subtotal_vnd)}
            </p>
            <p>
              <span className="text-slate-500">Phí giao hàng:</span>{" "}
              {formatVnd(order.shipping_fee_vnd)}
            </p>
            <p>
              <span className="text-slate-500">Tổng cộng:</span>{" "}
              <strong className="text-brand-700">{formatVnd(order.total_vnd)}</strong>
            </p>
            <p className="pt-1 text-xs text-slate-600">
              Dinh dưỡng đơn: {Math.round(order.nutrition_snapshot.kcal)} kcal · P{" "}
              {Math.round(order.nutrition_snapshot.protein)}g · C{" "}
              {Math.round(order.nutrition_snapshot.carbs)}g · F{" "}
              {Math.round(order.nutrition_snapshot.fat)}g
            </p>
            {order.paid_at && (
              <p className="text-xs text-slate-500">
                Thanh toán: {new Date(order.paid_at).toLocaleString("vi-VN")}
              </p>
            )}
            {order.cooking_at && (
              <p className="text-xs text-slate-500">
                Chế biến: {new Date(order.cooking_at).toLocaleString("vi-VN")}
              </p>
            )}
            {order.packed_at && (
              <p className="text-xs text-slate-500">
                Đóng gói: {new Date(order.packed_at).toLocaleString("vi-VN")}
              </p>
            )}
            {order.delivered_at && (
              <p className="text-xs text-slate-500">
                Đã giao: {new Date(order.delivered_at).toLocaleString("vi-VN")}
              </p>
            )}
          </div>
        </div>
      </section>

      <section className="mt-6 rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="text-lg font-bold text-brand-950">Danh sách món đặt</h2>
        <div className="mt-3 divide-y divide-slate-100">
          {order.items.map((item, idx) => (
            <div
              key={`${item.dishId}-${idx}`}
              className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm"
            >
              <div>
                <p className="font-bold text-slate-900">
                  {idx + 1}. {item.name}
                </p>
                <p className="text-xs text-slate-500">
                  Khối lượng: {item.grams}g · {Math.round(item.nutrition.kcal)} kcal · P{" "}
                  {Math.round(item.nutrition.protein)}g · C{" "}
                  {Math.round(item.nutrition.carbs)}g · F{" "}
                  {Math.round(item.nutrition.fat)}g
                </p>
              </div>
              <span className="font-bold text-brand-700">
                {formatVnd(item.unitPrice)}
              </span>
            </div>
          ))}
        </div>
      </section>

      {showPortions && (
        <section className="mt-6 rounded-2xl bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-brand-950">
              Khẩu phần đã đóng gói (Nutrition Snapshots)
            </h2>
            <Link
              href={`/admin/orders/${order.id}/labels`}
              className="text-sm font-bold text-brand-700 hover:underline"
            >
              Mở trang in tem →
            </Link>
          </div>

          {portions.length === 0 ? (
            <p className="mt-3 text-sm text-slate-500">
              Chưa tìm thấy dữ liệu khẩu phần.
            </p>
          ) : (
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {portions.map((portion) => (
                <article
                  key={portion.id}
                  className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm"
                >
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-bold text-brand-950">{portion.dishName}</h3>
                    <span className="rounded bg-brand-100 px-2 py-0.5 font-mono text-xs font-bold text-brand-700">
                      {portion.qrCode}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-slate-700">
                    Thực cân: <strong>{portion.actualGrams}g</strong> ·{" "}
                    <strong>{portion.kcal} kcal</strong> (P {portion.proteinG}g · C{" "}
                    {portion.carbsG}g · F {portion.fatG}g)
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Chế biến: {portion.cookedAt} · Đóng gói:{" "}
                    {new Date(portion.packedAt).toLocaleString("vi-VN")}
                  </p>
                  {portion.lotCode && (
                    <p className="text-xs text-slate-500">Lot: {portion.lotCode}</p>
                  )}
                  {portion.sourceNote && (
                    <p className="text-xs text-slate-500">
                      Nguồn: {portion.sourceNote}
                    </p>
                  )}
                  <Link
                    href={`/n/${portion.qrCode}`}
                    className="mt-2 inline-block text-xs font-bold text-brand-700 hover:underline"
                  >
                    Xem trang truy xuất công khai →
                  </Link>
                </article>
              ))}
            </div>
          )}
        </section>
      )}
    </main>
  );
}
