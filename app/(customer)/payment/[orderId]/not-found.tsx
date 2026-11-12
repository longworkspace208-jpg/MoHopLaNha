import Link from "next/link";

export default function PaymentOrderNotFound() {
  return (
    <main className="mx-auto min-h-screen max-w-lg px-4 py-12">
      <div className="rounded-3xl bg-white p-8 text-center shadow-sm">
        <div className="text-4xl">💳</div>
        <h1 className="mt-3 text-2xl font-black text-brand-950">
          Không tìm thấy đơn thanh toán
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          Đường dẫn thanh toán không hợp lệ hoặc đơn hàng không tồn tại trong hệ thống.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link
            href="/menu"
            className="rounded-full bg-orange-500 px-6 py-3 text-sm font-bold text-white shadow-sm hover:bg-orange-600"
          >
            Xem thực đơn hôm nay
          </Link>
          <Link
            href="/"
            className="rounded-full bg-brand-50 px-5 py-3 text-sm font-bold text-brand-800 hover:bg-brand-100"
          >
            Về trang chủ
          </Link>
        </div>
      </div>
    </main>
  );
}

