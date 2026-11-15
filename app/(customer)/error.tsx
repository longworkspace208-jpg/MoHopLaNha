"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function CustomerError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Ghi nhận lỗi ra console để debug khi cần
    console.error("Lỗi ứng dụng khách hàng:", error);
  }, [error]);

  function handleResetCart() {
    try {
      if (typeof window !== "undefined") {
        window.localStorage.removeItem("mhlh-cart");
      }
    } catch {
      // Bỏ qua lỗi truy cập localStorage
    }
    reset();
  }

  return (
    <main className="mx-auto flex min-h-[70vh] max-w-xl flex-col items-center justify-center px-4 py-16 text-center">
      <div className="w-full border border-rule bg-white p-8 shadow-sm sm:p-12">
        <span className="font-mono text-[11px] font-bold uppercase tracking-[0.2em] text-coral">
          Thông báo hệ thống
        </span>
        <h1 className="mt-3 font-display text-2xl font-semibold text-forest sm:text-3xl">
          Đã xảy ra lỗi khi tải dữ liệu
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          Dữ liệu phiên làm việc hoặc giỏ hàng cũ trên trình duyệt không tương thích với phiên bản mới của hệ thống.
        </p>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <button
            type="button"
            onClick={handleResetCart}
            className="bg-coral px-6 py-3 font-mono text-xs font-bold uppercase tracking-[0.16em] text-white shadow-sm transition-all hover:bg-coral-hover hover:shadow-md"
          >
            Làm mới giỏ hàng &amp; thử lại
          </button>
          <button
            type="button"
            onClick={() => reset()}
            className="border-2 border-forest bg-transparent px-6 py-3 font-mono text-xs font-bold uppercase tracking-[0.16em] text-forest transition-colors hover:bg-forest hover:text-white"
          >
            Tải lại trang
          </button>
        </div>

        <div className="mt-6 border-t border-rule pt-4">
          <Link
            href="/"
            className="font-mono text-xs font-semibold text-forest hover:text-coral hover:underline"
          >
            ← Về trang chủ Mở Hộp Là Nhà
          </Link>
        </div>
      </div>
    </main>
  );
}

