import Link from "next/link";
import { AdminNav } from "@/components/admin-nav";

export default function AdminOrderNotFound() {
  return (
    <main className="mx-auto max-w-4xl p-5">
      <AdminNav active="orders" />
      <div className="rounded-2xl bg-white p-8 text-center shadow-sm">
        <h1 className="text-xl font-black text-brand-950">
          Không tìm thấy đơn hàng
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          Mã đơn hàng này không tồn tại hoặc dữ liệu demo vừa được reset.
        </p>
        <Link
          href="/admin/orders"
          className="mt-5 inline-block rounded-full bg-brand-700 px-5 py-2.5 text-sm font-bold text-white hover:bg-brand-800"
        >
          ← Quay lại danh sách đơn hàng
        </Link>
      </div>
    </main>
  );
}

