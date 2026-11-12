import { notFound } from "next/navigation";
import { getOrderById } from "@/lib/orders-db";
import { generateVietQrPayload, getVietQrImageUrl } from "@/lib/bank-config";
import { PaymentView } from "@/components/payment-view";

export const dynamic = "force-dynamic";

export default async function PaymentPage({
  params
}: {
  params: Promise<{ orderId: string }>;
}) {
  const { orderId } = await params;
  const order = await getOrderById(orderId);

  if (!order) {
    notFound();
  }

  const vietQrImageUrl = getVietQrImageUrl(order.total_vnd, order.public_code);
  const vietQrPayload = generateVietQrPayload(order.total_vnd, order.public_code);
  const qrSvgUrl = `/api/qr?data=${encodeURIComponent(vietQrPayload)}`;

  return (
    <main className="mx-auto min-h-screen max-w-lg px-4 pb-16 pt-6">
      <PaymentView
        order={order}
        vietQrImageUrl={vietQrImageUrl}
        qrSvgUrl={qrSvgUrl}
      />
    </main>
  );
}

