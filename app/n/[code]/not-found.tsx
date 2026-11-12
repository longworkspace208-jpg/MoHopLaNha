import Link from "next/link";

export default function PortionNotFoundPage() {
  return (
    <main className="grid min-h-screen place-items-center bg-brand-950 px-4 py-8">
      <section className="w-full max-w-md rounded-[2rem] bg-cream p-6 text-center shadow-2xl sm:p-8">
        <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-orange-600">
          Mở Hộp Là Nhà
        </p>
        <div className="mx-auto mt-4 grid h-16 w-16 place-items-center rounded-full bg-amber-100 text-3xl">
          🍱
        </div>
        <h1 className="mt-4 text-2xl font-black text-brand-950">
          Không tìm thấy mã suất ăn
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          Mã QR hoặc mã suất bạn vừa truy cập không tồn tại, bị nhập sai hoặc
          chưa được chốt thông tin đóng gói.
        </p>
        <p className="mt-3 rounded-xl bg-white p-3 text-xs text-slate-500 shadow-sm">
          Vui lòng kiểm tra lại tem nhãn trên hộp cơm hoặc liên hệ đội ngũ Mở Hộp
          Là Nhà để được hỗ trợ.
        </p>
        <Link
          href="/"
          className="mt-6 inline-block w-full rounded-full bg-brand-700 px-6 py-3.5 text-sm font-bold text-white shadow-sm transition hover:bg-brand-950"
        >
          Về trang chủ Mở Hộp Là Nhà
        </Link>
      </section>
    </main>
  );
}

