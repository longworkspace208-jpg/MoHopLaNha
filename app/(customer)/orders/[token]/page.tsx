import { notFound } from "next/navigation";
import Link from "next/link";
import { getOrderByPublicToken } from "@/lib/orders-db";
import { formatVnd } from "@/lib/format";
import type { OrderStatus } from "@/lib/types";

export const dynamic = "force-dynamic";

function maskPhone(phone: string): string {
  const cleaned = phone.trim();
  if (cleaned.length >= 10) {
    return `${cleaned.slice(0, 3)}****${cleaned.slice(-3)}`;
  }
  return cleaned.slice(0, 2) + "****";
}

function maskAddress(addr: string): string {
  // Ẩn số nhà cụ thể để bảo vệ quyền riêng tư người nhận
  return addr.replace(/^\d+[\w/-]*\s+/, "*** ");
}

const STATUS_CONFIG: Record<
  OrderStatus,
  { label: string; badgeClass: string; description: string; step: number }
> = {
  awaiting_payment: {
    label: "Chờ thanh toán",
    badgeClass: "border-2 border-coral text-coral bg-coral/10 font-bold",
    description: "Đơn hàng đang chờ bạn quét mã VietQR để thanh toán.",
    step: 1,
  },
  pending_verification: {
    label: "Đang đối soát chuyển khoản",
    badgeClass: "border-2 border-forest text-forest bg-forest/10 font-bold",
    description:
      "Chúng mình đã nhận thông báo bạn đã chuyển khoản và đang đối soát sao kê ngân hàng. Cơm sẽ được bắt đầu làm ngay sau khi tiền khớp!",
    step: 2,
  },
  paid: {
    label: "Đã xác nhận thanh toán",
    badgeClass: "border-2 border-forest bg-forest text-white font-bold",
    description:
      "Đơn hàng đã được xác nhận thanh toán thành công và đang chờ bếp chuẩn bị.",
    step: 3,
  },
  cooking: {
    label: "Đang chế biến",
    badgeClass: "border-2 border-coral bg-coral text-white font-bold",
    description:
      "Bếp đang chế biến phần ăn tươi mới theo đúng định lượng dinh dưỡng của bạn.",
    step: 3,
  },
  packed: {
    label: "Đã đóng gói",
    badgeClass: "border-2 border-forest bg-forest-dark text-white font-bold",
    description:
      "Phần ăn đã được cân định lượng, dán tem QR truy xuất và sẵn sàng giao.",
    step: 3,
  },
  delivered: {
    label: "Đã giao hàng",
    badgeClass: "border-2 border-forest bg-forest text-white font-bold",
    description: "Đơn hàng đã được giao thành công. Chúc bạn ngon miệng!",
    step: 3,
  },
  cancelled: {
    label: "Đã hủy",
    badgeClass: "border-2 border-red-700 text-red-800 bg-red-50 font-bold",
    description: "Đơn hàng đã bị hủy.",
    step: 0,
  },
};

export default async function OrderStatusPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const decodedToken = decodeURIComponent(token).trim();
  const order = await getOrderByPublicToken(decodedToken);

  if (!order) {
    notFound();
  }

  const currentStatusInfo =
    STATUS_CONFIG[order.status] ?? STATUS_CONFIG.awaiting_payment;

  const isStep2Done = order.status !== "awaiting_payment" && order.status !== "cancelled";
  const isKitchenActive = ["paid", "cooking", "packed", "delivered"].includes(
    order.status
  );

  return (
    <main className="mx-auto min-h-screen max-w-4xl px-4 pb-20 pt-8 sm:px-6 lg:px-10">
      {/* Header theo dõi đơn hàng */}
      <header className="flex flex-col justify-between gap-4 border-b-2 border-forest pb-5 sm:flex-row sm:items-end">
        <div>
          <span className="font-mono text-[11px] font-bold uppercase tracking-[0.2em] text-coral">
            Hồ sơ đơn hàng · Mở Hộp Là Nhà
          </span>
          <h1 className="mt-1 font-display text-4xl font-semibold tracking-tight text-forest">
            #{order.public_code}
          </h1>
          <p className="mt-1 font-mono text-xs text-muted">
            Mã chuyển khoản &amp; tra cứu: <strong className="text-forest">#{order.public_code}</strong>
          </p>
        </div>
        <span
          className={`inline-block px-3.5 py-1.5 font-mono text-xs uppercase tracking-[0.14em] shadow-sm ${currentStatusInfo.badgeClass}`}
        >
          {currentStatusInfo.label}
        </span>
      </header>

      {/* Tiến độ 3 bước đường kẻ mảnh */}
      <section className="mt-8 border border-rule bg-white p-6 shadow-sm sm:p-8">
        <h2 className="font-mono text-xs font-bold uppercase tracking-[0.18em] text-forest">
          Tiến độ đơn hàng
        </h2>

        <div className="mt-5 grid grid-cols-3 divide-x divide-rule border border-rule">
          <div className="bg-forest/5 p-3.5 sm:p-4">
            <span className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-forest">
              01 · Hoàn tất
            </span>
            <p className="mt-1 font-display text-base font-semibold text-ink">
              Đặt đơn
            </p>
          </div>

          <div
            className={`p-3.5 sm:p-4 ${
              order.status === "awaiting_payment" ? "bg-white" : "bg-forest/5"
            }`}
          >
            <span
              className={`font-mono text-[10px] font-bold uppercase tracking-[0.16em] ${
                order.status === "awaiting_payment"
                  ? "text-coral"
                  : isStep2Done
                    ? "text-forest"
                    : "text-muted"
              }`}
            >
              {order.status === "awaiting_payment" ? "02 · Chờ chuyển" : "02 · Đã báo chuyển"}
            </span>
            <p className="mt-1 font-display text-base font-semibold text-ink">
              Chuyển khoản
            </p>
          </div>

          <div className={`p-3.5 sm:p-4 ${isKitchenActive ? "bg-forest/5" : "bg-white"}`}>
            <span
              className={`font-mono text-[10px] font-bold uppercase tracking-[0.16em] ${
                order.status === "delivered"
                  ? "text-forest"
                  : order.status === "cancelled"
                    ? "text-red-700"
                    : isKitchenActive || order.status === "pending_verification"
                      ? "text-coral"
                      : "text-muted"
              }`}
            >
              {order.status === "delivered"
                ? "03 · Hoàn tất"
                : order.status === "cancelled"
                  ? "03 · Đã hủy"
                  : order.status === "pending_verification"
                    ? "03 · Đang đối soát"
                    : isKitchenActive
                      ? "03 · Đang thực hiện"
                      : "03 · Tiếp theo"}
            </span>
            <p className="mt-1 font-display text-base font-semibold text-ink">
              Chế biến &amp; Giao
            </p>
          </div>
        </div>

        <div className="mt-5 border-l-4 border-l-coral bg-coral/5 px-4 py-3.5 text-sm text-ink">
          <p className="font-medium leading-relaxed">
            {currentStatusInfo.description}
          </p>
          {order.status === "awaiting_payment" && (
            <Link
              href={`/payment/${order.public_token}`}
              className="mt-3.5 inline-block bg-coral px-5 py-2.5 font-mono text-xs font-bold uppercase tracking-[0.14em] text-white shadow-sm transition-all hover:bg-coral-hover hover:shadow-md"
            >
              Mở trang quét mã VietQR →
            </Link>
          )}
        </div>
      </section>

      <div className="mt-8 grid gap-8 lg:grid-cols-12 lg:items-start">
        {/* Cột trái: Món ăn & Địa chỉ */}
        <div className="space-y-8 lg:col-span-7">
          <section className="border border-rule bg-white p-6 shadow-sm">
            <h2 className="border-b border-rule pb-3 font-display text-xl font-semibold text-forest">
              Món ăn trong đơn ({order.items.length} món)
            </h2>
            <div className="divide-y divide-rule">
              {order.items.map((item, idx) => (
                <article key={idx} className="py-3.5">
                  <div className="flex items-baseline justify-between gap-3">
                    <div>
                      <strong className="font-display text-lg font-semibold text-ink">
                        {item.name}
                      </strong>
                      <span className="ml-2 font-mono text-xs text-muted">
                        ({item.grams}g)
                      </span>
                    </div>
                    <span className="font-mono text-base font-bold tabular-nums text-coral">
                      {formatVnd(item.unitPrice)}
                    </span>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-3 font-mono text-xs tabular-nums text-muted">
                    <span>{Math.round(item.nutrition.kcal)} kcal</span>
                    <span className="text-forest font-semibold">P {item.nutrition.protein.toFixed(1)}g</span>
                    <span>C {item.nutrition.carbs.toFixed(1)}g</span>
                    <span>F {item.nutrition.fat.toFixed(1)}g</span>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section className="border border-rule bg-white p-6 shadow-sm">
            <h2 className="border-b border-rule pb-3 font-display text-xl font-semibold text-forest">
              Thông tin nhận cơm
            </h2>
            <div className="mt-3 space-y-2 text-sm text-muted">
              <p>
                <strong className="text-ink font-semibold">{order.customer_name}</strong>{" "}
                · <span className="font-mono text-forest font-semibold">{maskPhone(order.phone)}</span>
              </p>
              <p className="text-ink">{maskAddress(order.delivery_address)}</p>
              {order.customer_email && (
                <p className="font-mono text-xs text-muted">
                  Thông báo: Đã liên kết email nhận thông báo
                </p>
              )}
              {order.note && (
                <p className="mt-2 border-l-4 border-coral bg-coral/5 px-3 py-2 text-xs text-ink">
                  Ghi chú: {order.note}
                </p>
              )}
            </div>
          </section>
        </div>

        {/* Cột phải: Snapshot dinh dưỡng & Tổng kết tiền */}
        <aside className="space-y-6 lg:col-span-5">
          <section className="border border-rule bg-white p-6 shadow-sm">
            <h3 className="border-b border-rule pb-2.5 font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-forest">
              Dinh dưỡng tổng thể (Snapshot bất biến)
            </h3>
            <dl className="mt-3 grid grid-cols-2 gap-4">
              <div>
                <dt className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">
                  Năng lượng
                </dt>
                <dd className="mt-0.5 font-mono text-base font-bold tabular-nums text-ink">
                  {Math.round(order.nutrition_snapshot.kcal)} kcal
                </dd>
              </div>
              <div>
                <dt className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">
                  Protein
                </dt>
                <dd className="mt-0.5 font-mono text-base font-bold tabular-nums text-forest">
                  {order.nutrition_snapshot.protein.toFixed(1)}g
                </dd>
              </div>
              <div>
                <dt className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">
                  Carbs
                </dt>
                <dd className="mt-0.5 font-mono text-base font-bold tabular-nums text-ink">
                  {order.nutrition_snapshot.carbs.toFixed(1)}g
                </dd>
              </div>
              <div>
                <dt className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">
                  Fat
                </dt>
                <dd className="mt-0.5 font-mono text-base font-bold tabular-nums text-coral">
                  {order.nutrition_snapshot.fat.toFixed(1)}g
                </dd>
              </div>
            </dl>
          </section>

          <section className="bg-forest p-6 text-white shadow-sm">
            <h3 className="border-b border-white/20 pb-3 font-display text-xl font-semibold text-white">
              Tổng kết thanh toán
            </h3>
            <div className="mt-4 space-y-2.5 text-sm text-ivory/80">
              <div className="flex justify-between">
                <span>Tạm tính món ăn</span>
                <span className="font-mono font-bold tabular-nums text-white">
                  {formatVnd(order.subtotal_vnd)}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Phí giao hàng</span>
                <span className="font-mono font-bold tabular-nums text-white">
                  {formatVnd(order.shipping_fee_vnd)}
                </span>
              </div>
              <div className="flex items-baseline justify-between border-t border-white/20 pt-3">
                <span className="font-display text-lg font-semibold text-white">
                  Tổng thanh toán
                </span>
                <span className="font-display text-3xl font-bold text-coral">
                  {formatVnd(order.total_vnd)}
                </span>
              </div>
            </div>
          </section>
        </aside>
      </div>

      <div className="mt-10 border-t border-rule pt-6">
        <Link
          href="/"
          className="inline-block border-b-2 border-forest pb-0.5 font-mono text-xs font-bold uppercase tracking-[0.14em] text-forest transition-colors hover:border-coral hover:text-coral"
        >
          ← Quay về trang chủ Mở Hộp Là Nhà
        </Link>
      </div>
    </main>
  );
}
