import type { Metadata } from "next";
import { OrderTracker } from "@/components/order-tracker";

export const metadata: Metadata = {
  title: "Theo dõi đơn hàng — Mở Hộp Là Nhà",
  description:
    "Tra cứu tiến trình nấu cơm, kiểm tra trạng thái chuyển khoản và lịch trình giao hàng thực tế của đơn cơm Mở Hộp Là Nhà.",
};

export default function CustomerOrdersPage() {
  return (
    <main className="mx-auto min-h-screen max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8">
        <h1 className="font-display text-3xl font-black text-forest sm:text-4xl">
          Theo dõi đơn hàng
        </h1>
        <p className="mt-2 text-sm text-muted sm:text-base">
          Minh bạch từng bước từ lúc tiếp nhận, xác nhận thanh toán, bếp nấu định lượng cho tới khi giao đến tay bạn.
        </p>
      </div>

      <OrderTracker />
    </main>
  );
}
