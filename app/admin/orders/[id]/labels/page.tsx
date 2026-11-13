import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { isAdmin } from "@/lib/admin-auth";
import { getOrderById, getPortionsByOrder } from "@/lib/orders-db";
import { AdminNav } from "@/components/admin-nav";
import { PrintButton } from "@/components/print-button";

export const dynamic = "force-dynamic";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3001";

export default async function AdminOrderLabelsPage({
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

  const portions = await getPortionsByOrder(order.id);

  return (
    <main className="mx-auto max-w-5xl p-5 print:max-w-none print:p-0">
      <div className="print:hidden">
        <AdminNav active="orders" />
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <Link
              href={`/admin/orders/${order.id}`}
              className="text-sm font-bold text-brand-700 hover:underline"
            >
              ← Quay lại đơn #{order.public_code}
            </Link>
            <h1 className="mt-2 text-2xl font-black text-brand-950">
              In tem nhãn #{order.public_code}
            </h1>
            <p className="text-sm text-slate-600">
              {portions.length} khẩu phần · Quét QR để xem dinh dưỡng tại{" "}
              <span className="font-mono text-xs">{SITE_URL}/n/...</span>
            </p>
          </div>
          <PrintButton />
        </div>
      </div>

      {portions.length === 0 ? (
        <div className="rounded-2xl bg-white p-6 text-center text-sm text-slate-600 shadow-sm print:hidden">
          Đơn hàng chưa có khẩu phần nào được đóng gói.{" "}
          <Link
            href={`/admin/orders/${order.id}/pack`}
            className="font-bold text-brand-700 hover:underline"
          >
            Đi tới màn hình cân & đóng gói →
          </Link>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 print:block print:space-y-4">
          {portions.map((portion) => {
            const traceUrl = `${SITE_URL}/n/${portion.qrCode}`;
            const qrSrc = `/api/qr?data=${encodeURIComponent(traceUrl)}`;
            return (
              <article
                key={portion.id}
                className="break-inside-avoid rounded-2xl border-2 border-brand-950 bg-white p-4 text-center shadow-sm print:mb-4 print:inline-block print:w-[72mm] print:mr-3 print:shadow-none"
              >
                <p className="text-xs font-extrabold uppercase tracking-widest text-brand-700">
                  Mở Hộp Là Nhà
                </p>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={qrSrc}
                  alt={`QR ${portion.qrCode}`}
                  className="mx-auto my-2 h-36 w-36 rounded-lg bg-white p-1"
                />
                <h2 className="text-base font-black text-brand-950">
                  {portion.dishName}
                </h2>
                <p className="mt-1 text-sm font-bold text-slate-800">
                  {portion.actualGrams}g · {portion.kcal} kcal
                </p>
                <p className="mt-1 font-mono text-xs font-bold text-brand-700">
                  {portion.qrCode}
                </p>
                <div className="mt-2 border-t border-dashed border-slate-300 pt-2 text-[11px] text-slate-600">
                  <p>Chế biến: {portion.cookedAt}</p>
                  <p>
                    Đóng gói:{" "}
                    {new Date(portion.packedAt).toLocaleString("vi-VN")}
                  </p>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </main>
  );
}
