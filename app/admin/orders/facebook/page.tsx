import Link from "next/link";
import { AdminNav } from "@/components/admin-nav";
import { FacebookOrderForm } from "@/components/facebook-order-form";

export const dynamic = "force-dynamic";

export default function AdminFacebookOrderPage() {
  return (
    <main className="mx-auto max-w-4xl p-5">
      <AdminNav active="facebook" />

      <div className="mb-4">
        <Link
          href="/admin"
          className="text-sm font-bold text-brand-700 hover:underline"
        >
          ← Quay lại danh sách đơn hàng
        </Link>
      </div>

      <header className="mb-6">
        <h1 className="text-2xl font-black text-brand-950">
          Nhập đơn hàng từ Facebook
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Tạo đơn nội bộ cho khách đặt qua tin nhắn Facebook. Đơn mới sẽ ở trạng thái chờ thanh toán / đối soát.
        </p>
      </header>

      <FacebookOrderForm />
    </main>
  );
}
