import Link from "next/link";
import { CartBadge } from "./cart-badge";

export function CustomerHeader() {
  return (
    <header className="sticky top-0 z-20 border-b border-brand-100 bg-cream/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/" className="font-extrabold tracking-tight text-brand-950">
          Mở Hộp <span className="text-orange-500">Là Nhà</span>
        </Link>
        <div className="flex items-center gap-2">
          <CartBadge />
        </div>
      </div>
    </header>
  );
}
