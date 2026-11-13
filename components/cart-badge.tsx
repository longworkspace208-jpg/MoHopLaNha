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
      className="group inline-flex items-center gap-2.5 rounded-sm border border-forest/30 bg-white px-4 py-2 font-mono text-xs font-bold uppercase tracking-[0.14em] text-forest transition-all hover:border-forest hover:bg-forest hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest"
      aria-label="Xem giỏ hàng"
    >
      <span>Giỏ hàng</span>
      <span
        className={`inline-flex h-5 min-w-5 items-center justify-center rounded-sm px-1 font-mono text-[11px] font-bold transition-colors ${
          totalItems > 0
            ? "bg-coral text-white shadow-xs group-hover:bg-white group-hover:text-forest"
            : "border border-forest/20 text-muted group-hover:border-white/40 group-hover:text-white"
        }`}
      >
        {String(totalItems).padStart(2, "0")}
      </span>
    </Link>
  );
}
