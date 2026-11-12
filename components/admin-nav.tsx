import Link from "next/link";

type AdminSection =
  | "ingredients"
  | "dishes"
  | "menu"
  | "orders"
  | "cooking"
  | "facebook";

export function AdminNav({ active }: { active: AdminSection }) {
  const links: Array<{ key: AdminSection; href: string; label: string }> = [
    { key: "ingredients", href: "/admin/ingredients", label: "Nguyên liệu" },
    { key: "dishes", href: "/admin/dishes", label: "Món ăn" },
    { key: "menu", href: "/admin/menu", label: "Thực đơn" },
    { key: "orders", href: "/admin", label: "Đơn hàng" },
    { key: "cooking", href: "/admin/cooking", label: "Chế biến" },
    { key: "facebook", href: "/admin/orders/facebook", label: "Nhập đơn FB" },
  ];

  return (
    <nav className="mb-6 flex flex-wrap gap-2 border-b border-slate-200 pb-4 text-sm font-bold print:hidden">
      {links.map((item) => {
        const isActive = item.key === active;
        return (
          <Link
            key={item.key}
            href={item.href}
            className={
              isActive
                ? "rounded-xl bg-brand-700 px-3.5 py-2 text-white shadow-sm"
                : "rounded-xl px-3.5 py-2 text-brand-700 hover:bg-brand-50"
            }
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
