import Link from "next/link";
import { CartBadge } from "./cart-badge";

export function CustomerHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-rule bg-ivory/95 backdrop-blur-sm">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-10">
        <Link
          href="/"
          className="group flex items-baseline gap-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest"
        >
          <span className="font-display text-xl font-bold tracking-tight text-forest sm:text-2xl">
            Mở Hộp{" "}
            <span className="font-semibold italic text-coral transition-colors group-hover:text-coral-hover">
              Là Nhà
            </span>
          </span>
          <span className="hidden border-l border-rule pl-3 font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-muted md:inline-block">
            Bếp cơm định lượng
          </span>
        </Link>

        <nav
          aria-label="Điều hướng chính"
          className="hidden items-center gap-8 font-mono text-xs font-bold uppercase tracking-[0.16em] text-muted md:flex"
        >
          <Link
            href="/menu"
            className="border-b-2 border-transparent py-1 transition-colors hover:border-forest hover:text-forest"
          >
            Thực đơn
          </Link>
          <Link
            href="/#chon-khau-phan"
            className="border-b-2 border-transparent py-1 transition-colors hover:border-forest hover:text-forest"
          >
            Cá nhân hóa
          </Link>
          <Link
            href="/#quy-trinh-qr"
            className="border-b-2 border-transparent py-1 transition-colors hover:border-forest hover:text-forest"
          >
            Minh bạch QR
          </Link>
          <Link
            href="/orders"
            className="border-b-2 border-transparent py-1 transition-colors hover:border-forest hover:text-forest"
          >
            Theo dõi đơn
          </Link>
        </nav>

        <div className="flex items-center gap-3">
          <Link
            href="/orders"
            title="Theo dõi đơn hàng của bạn"
            className="flex items-center gap-1.5 rounded-sm border border-rule bg-white px-2.5 py-1.5 font-mono text-xs font-semibold text-forest transition-colors hover:border-forest hover:bg-forest/5"
          >
            <svg
              className="h-4 w-4 text-forest"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
              />
            </svg>
            <span className="hidden sm:inline">Đơn của tôi</span>
          </Link>
          <CartBadge />
        </div>
      </div>
    </header>
  );
}
