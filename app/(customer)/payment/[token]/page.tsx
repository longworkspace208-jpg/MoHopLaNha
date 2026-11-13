import { notFound } from "next/navigation";
import { getOrderByPublicToken } from "@/lib/orders-db";
import { generateVietQrPayload, getVietQrImageUrl } from "@/lib/bank-config";
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

  const vietQrImageUrl = getVietQrImageUrl(order.total_vnd, order.public_code);
  const vietQrPayload = generateVietQrPayload(order.total_vnd, order.public_code);
  const qrSvgUrl = `/api/qr?data=${encodeURIComponent(vietQrPayload)}`;

  return (
    <main className="mx-auto min-h-screen max-w-5xl px-4 pb-20 pt-8 sm:px-6 lg:px-10">
      <PaymentView
        order={order}
        vietQrImageUrl={vietQrImageUrl}
        qrSvgUrl={qrSvgUrl}
      />
    </main>
  );
}
