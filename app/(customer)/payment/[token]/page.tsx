import { notFound, redirect } from "next/navigation";
import { getOrderByPublicToken } from "@/lib/orders-db";
import { getBankConfig } from "@/lib/bank-config";
import { PaymentView } from "@/components/payment-view";

export const dynamic = "force-dynamic";

export default async function PaymentPage({
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

  // Nếu đơn hàng đã được xác nhận thanh toán hoặc đã hủy, chuyển thẳng sang trang theo dõi đơn
  if (order.status !== "awaiting_payment" && order.status !== "pending_verification") {
    redirect(`/orders/${order.public_token}`);
  }

  const bankConfig = getBankConfig();

  return (
    <main className="mx-auto min-h-screen max-w-4xl px-4 pb-20 pt-8 sm:px-6 lg:px-8">
      <PaymentView order={order} bankConfig={bankConfig} />
    </main>
  );
}
