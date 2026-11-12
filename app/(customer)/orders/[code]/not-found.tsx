import Link from "next/link";

export default function OrderNotFound() {
  return (
    <main className="mx-auto min-h-screen max-w-lg px-4 py-12">
      <div className="rounded-3xl bg-white p-8 text-center shadow-sm">
        <div className="text-4xl">📦</div>
        <h1 className="mt-3 text-2xl font-black text-brand-950">
          Không tìm thấy mã đơn hàng
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          Mã đơn bạn đang tra cứu không đúng hoặc chưa được khởi tạo. Vui lòng kiểm tra lại mã đơn (ví dụ: MHLN1001).
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link
            href="/menu"
            className="rounded-full bg-orange-500 px-6 py-3 text-sm font-bold text-white shadow-sm hover:bg-orange-600"
          >
            Đặt bữa mới
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

