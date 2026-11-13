import { redirect } from "next/navigation";
import nextDynamic from "next/dynamic";
import { isAdmin } from "@/lib/admin-auth";
import { getAllOrders } from "@/lib/orders-db";
import { AdminNav } from "@/components/admin-nav";

const AdminOrdersBoard = nextDynamic(
  () => import("@/components/admin-orders-board").then((m) => m.AdminOrdersBoard),
  {
    loading: () => (
      <div className="p-8 text-center text-sm text-slate-500">
        Đang tải bảng đơn hàng…
      </div>
    ),
  }
);

const CollapsibleFacebookOrder = nextDynamic(
  () =>
    import("@/components/collapsible-facebook-order").then(
      (m) => m.CollapsibleFacebookOrder
    )
);

export const dynamic = "force-dynamic";

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  if (!(await isAdmin())) {
    redirect("/admin/login");
  }

  const [{ status }, orders] = await Promise.all([
    searchParams,
    getAllOrders(),
  ]);

  return (
    <main className="mx-auto max-w-4xl p-5">
      <AdminNav active="orders" />
      <header className="mb-6">
        <h1 className="text-2xl font-black text-brand-950">Quản trị đơn hàng</h1>
        <p className="mt-1 text-sm text-slate-600">
          Theo dõi luồng đối soát chuyển khoản, chế biến, cân đóng gói và giao hàng.
        </p>
      </header>
      <CollapsibleFacebookOrder />
      <AdminOrdersBoard orders={orders} initialStatus={status} />
    </main>
  );
}
