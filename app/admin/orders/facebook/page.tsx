import Link from "next/link";
import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/admin-auth";
import { AdminNav } from "@/components/admin-nav";
import { FacebookOrderForm } from "@/components/facebook-order-form";

export const dynamic = "force-dynamic";

export default async function AdminFacebookOrderPage() {
  if (!(await isAdmin())) {
    redirect("/admin/login");
  }

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

      <div className="mb-6">
        <h1 className="text-2xl font-black text-brand-950">
          Tạo đơn Facebook / Chat
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Dành cho nhân viên trực fanpage chốt đơn nhanh qua tin nhắn, tự động
          sinh mã VietQR và kiểm tra định lượng gram hợp lệ.
        </p>
      </div>

      <FacebookOrderForm />
    </main>
  );
}
