import { notFound } from "next/navigation";
import { getOrderByPublicToken } from "@/lib/orders-db";
import { OrderStatusView } from "@/components/order-status-view";

export const dynamic = "force-dynamic";

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

  return (
    <main className="mx-auto min-h-screen max-w-4xl px-4 pb-20 pt-8 sm:px-6 lg:px-8">
      <OrderStatusView order={order} />
    </main>
  );
}
