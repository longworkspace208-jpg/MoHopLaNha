"use client";
import Link from "next/link";
import { useCartStore } from "@/lib/cart-store";
import { useEffect, useState } from "react";

export function CartBadge() {
  const [mounted, setMounted] = useState(false);
  const lines = useCartStore((state) => state.lines);

  useEffect(() => {
    setMounted(true);
  }, []);

  const totalItems = mounted ? lines.length : 0;

  return (
    <Link
      href="/cart"
      className="relative flex items-center gap-1.5 rounded-full bg-brand-50 px-3.5 py-1.5 text-xs font-bold text-brand-800 transition hover:bg-brand-100"
      aria-label="Xem giỏ hàng"
    >
      <span>🛒 Giỏ hàng</span>
      {totalItems > 0 && (
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-orange-500 text-[11px] font-black text-white">
          {totalItems}
        </span>
      )}
    </Link>
  );
}

