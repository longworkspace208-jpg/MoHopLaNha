"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { MenuDish } from "@/lib/customer-menu";
import { useCartStore } from "@/lib/cart-store";
import { formatVnd } from "@/lib/format";

export type HeroDishItem = {
  id: string;
  shortName: string;
  title: string;
  categoryLabel: string;
  tagline: string;
  description: string;
  imageSrc: string;
  priceVnd: number;
  grams: number;
  kcal: number;
  proteinG: number;
  fallbackMenuDish: MenuDish;
};

interface HeroSectionProps {
  dishes: HeroDishItem[];
}

export function HeroSection({ dishes }: HeroSectionProps) {
  const router = useRouter();
  const people = useCartStore((state) => state.people);
  const setGoal = useCartStore((state) => state.setGoal);
  const addDish = useCartStore((state) => state.addDish);

  const [activeIndex, setActiveIndex] = useState(0);
  const [liveMenuDishes, setLiveMenuDishes] = useState<Record<string, MenuDish>>({});
  const [orderNotice, setOrderNotice] = useState("");
  const [ordering, setOrdering] = useState(false);

  const active = dishes[activeIndex] ?? dishes[0];

  useEffect(() => {
    let cancelled = false;
    fetch("/api/menu/today", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data && Array.isArray(data.dishes)) {
          const map: Record<string, MenuDish> = {};
          for (const d of data.dishes as MenuDish[]) {
            map[d.id] = d;
          }
          setLiveMenuDishes(map);
        }
      })
      .catch(() => {
        // Giữ fallbackMenuDish nếu offline
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!active) return null;

  const currentLiveDish = liveMenuDishes[active.id] ?? active.fallbackMenuDish;
  const remaining = currentLiveDish.remaining_portions ?? currentLiveDish.portion_limit;
  const isSoldOut = remaining <= 0;

  const handleOrderFeatured = (dishItem: HeroDishItem) => {
    const targetDish = liveMenuDishes[dishItem.id] ?? dishItem.fallbackMenuDish;
    const targetRemaining = targetDish.remaining_portions ?? targetDish.portion_limit;
    if (targetRemaining <= 0) {
      setOrderNotice(
        `Món "${dishItem.title}" đã hết suất hôm nay. Bạn vui lòng chọn món khác nhé.`
      );
      return;
    }

    setOrdering(true);
    setOrderNotice("");
    setGoal("custom");
    addDish({
      ...targetDish,
      image_url: dishItem.imageSrc,
    });
    router.push("/cart");
  };

  return (
    <section
      aria-label="Món ăn trứ danh Mở Hộp Là Nhà"
      className="relative w-full overflow-hidden border-b border-slate-200/80 bg-white"
    >
      {/* Nền doodle nhẹ toàn chiều ngang hero */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-[0.06]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='160' height='160' viewBox='0 0 160 160' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' stroke='%2320342b' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Ccircle cx='32' cy='32' r='14'/%3E%3Cpath d='M25 32h14M32 25v14'/%3E%3Cpath d='M105 22c10 0 18 8 18 18s-8 18-18 18c-3 0-12-8-12-18s9-18 12-18z'/%3E%3Cpath d='M24 106c12-10 28-6 32 8-14 6-26 2-32-8z'/%3E%3Cpath d='M106 104h28c0 12-6 20-14 20s-14-8-14-20z'/%3E%3Cpath d='M114 96c2-5 6-5 6 0M124 96c2-5 6-5 6 0'/%3E%3Cpath d='M68 72c6-8 18-8 22 0-6 8-16 8-22 0z'/%3E%3C/g%3E%3C/svg%3E")`,
          backgroundSize: "160px 160px",
        }}
      />

      {/* Phần thân chính: Mobile xếp dọc ưu tiên ảnh đĩa tròn, Desktop trải rộng toàn màn hình */}
      <div className="relative mx-auto flex max-w-7xl flex-col md:min-h-[470px] md:flex-row lg:min-h-[520px] lg:px-8">
        {/* Thanh danh mục dọc bên trái trên Desktop (dùng writing-mode dọc để không đè chữ) */}
        <aside className="hidden w-14 shrink-0 flex-col items-center justify-center gap-6 py-10 md:flex">
          {dishes.map((item, idx) => {
            const isSelected = idx === activeIndex;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setActiveIndex(idx);
                  setOrderNotice("");
                }}
                style={{ writingMode: "vertical-rl" }}
                className={`rotate-180 whitespace-nowrap py-1 text-xs font-bold tracking-wider transition ${
                  isSelected
                    ? "text-[#b85d43]"
                    : "text-slate-400 hover:text-[#1F2220]"
                }`}
              >
                {item.categoryLabel}
              </button>
            );
          })}
        </aside>

        {/* Khu vực đĩa món ăn trên nền tối (#1F2220) */}
        <div className="relative flex flex-col items-center md:w-[390px] md:shrink-0 lg:w-[460px]">
          {/* Khối nền tối: Mobile nằm trên cùng, Desktop kéo dài dọc cột đĩa */}
          <div className="w-full bg-[#1F2220] px-4 pb-28 pt-5 text-white md:absolute md:inset-y-0 md:left-0 md:w-[74%] md:px-7 md:pb-8 md:pt-8">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-extrabold uppercase tracking-[0.22em] text-amber-200/90">
                Mở Hộp Là Nhà
              </span>
              <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white/90 md:hidden">
                Món Trứ Danh
              </span>
            </div>

            {/* Pill chọn món nhanh trên Mobile (< md) */}
            <div className="mt-3 flex gap-1.5 overflow-x-auto pb-1 md:hidden">
              {dishes.map((item, idx) => {
                const isSelected = idx === activeIndex;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setActiveIndex(idx);
                      setOrderNotice("");
                    }}
                    className={`shrink-0 rounded-full px-3 py-1 text-[11px] font-bold transition ${
                      isSelected
                        ? "bg-orange-500 text-white"
                        : "bg-white/10 text-slate-300 hover:bg-white/20"
                    }`}
                  >
                    {item.categoryLabel}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Đĩa gốm tròn nổi bật nằm vắt qua ranh giới tối/sáng */}
          <div className="relative z-10 -mt-24 flex justify-center md:my-auto md:ml-14 md:py-10 lg:ml-16">
            <div className="relative h-60 w-60 overflow-hidden rounded-full border-4 border-[#2C302E] bg-[#171918] shadow-[0_24px_54px_rgba(0,0,0,0.44)] sm:h-72 sm:w-72 md:h-80 md:w-80 lg:h-[380px] lg:w-[380px]">
              <Image
                src={active.imageSrc}
                alt={active.title}
                width={500}
                height={500}
                priority
                unoptimized={active.imageSrc.endsWith(".svg")}
                className="h-full w-full scale-[1.24] object-cover transition duration-300"
              />
            </div>
          </div>
        </div>

        {/* Nội dung mô tả món, giá & nút ĐẶT NGAY */}
        <div className="relative z-10 flex flex-1 flex-col justify-center px-5 pb-6 pt-5 text-center md:py-12 md:pl-10 md:pr-6 md:text-left lg:pl-14">
          <div className="flex flex-wrap items-center justify-center gap-2 md:justify-start">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#b85d43]/10 px-3 py-1 text-[11px] font-extrabold uppercase tracking-wider text-[#b85d43]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#b85d43]" />
              {active.tagline}
            </span>
            <span className="rounded-full bg-brand-50 px-3 py-1 text-[11px] font-bold text-brand-800">
              {active.grams}g · ~{active.kcal} kcal (ước tính)
            </span>
          </div>

          <h1 className="mt-3 text-3xl font-black leading-tight tracking-tight text-[#1F2220] sm:text-4xl lg:text-5xl">
            {active.title}
          </h1>

          <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-slate-600 sm:text-base md:mx-0">
            {active.description}
          </p>

          <div className="mt-4 flex flex-wrap items-center justify-center gap-2 text-xs text-slate-500 md:justify-start">
            <span className="rounded-lg bg-slate-100 px-2.5 py-1 font-semibold text-slate-700">
              Protein ~{active.proteinG}g
            </span>
            <span className="rounded-lg bg-slate-100 px-2.5 py-1 font-semibold text-slate-700">
              Cân thực tế &amp; tem QR dinh dưỡng
            </span>
          </div>

          {/* Hàng Giá + CTA Đặt Ngay */}
          <div className="mt-6 flex flex-col items-center gap-4 sm:flex-row sm:flex-wrap sm:justify-center md:justify-start lg:gap-6">
            <div>
              <p className="text-3xl font-black tracking-tight text-[#b85d43] lg:text-4xl">
                {formatVnd(active.priceVnd)}
              </p>
              <p className="text-xs font-medium text-slate-500">
                Suất chuẩn {active.grams}g · Giao nóng nội thành
              </p>
            </div>

            <div className="flex w-full flex-col gap-2.5 sm:w-auto sm:flex-row sm:items-center">
              <button
                type="button"
                disabled={isSoldOut || ordering}
                onClick={() => handleOrderFeatured(active)}
                className="w-full whitespace-nowrap rounded-xl bg-[#1F2220] px-7 py-3.5 text-xs font-extrabold uppercase tracking-[0.14em] text-white shadow-md transition hover:bg-brand-950 active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-slate-300 sm:w-auto"
              >
                {isSoldOut
                  ? "Hết suất hôm nay"
                  : ordering
                    ? "Đang thêm vào giỏ…"
                    : `Đặt ngay (${people === 5 ? "5+" : people} người)`}
              </button>
              <Link
                href="/menu"
                className="whitespace-nowrap rounded-xl border border-slate-200 bg-white/95 px-5 py-3.5 text-center text-xs font-bold text-brand-800 transition hover:bg-brand-50"
              >
                Tùy chỉnh gram →
              </Link>
            </div>
          </div>

          {orderNotice && (
            <p
              role="alert"
              className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2 text-xs font-semibold text-rose-700"
            >
              {orderNotice}
            </p>
          )}
        </div>
      </div>

      {/* Dải 4 thẻ món nổi bật bên dưới (tương tự layout 4 thẻ tối có đĩa tròn gối lên góc trên) */}
      <div className="relative z-10 border-t border-slate-100/90 bg-white/80 backdrop-blur-[1px]">
        <div className="mx-auto max-w-7xl px-4 pb-8 pt-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 gap-x-3 gap-y-8 pt-6 md:grid-cols-4 md:gap-x-5 lg:gap-x-6">
          {dishes.map((item, idx) => {
            const isSelected = idx === activeIndex;
            const liveDish = liveMenuDishes[item.id] ?? item.fallbackMenuDish;
            const cardRemaining = liveDish.remaining_portions ?? liveDish.portion_limit;
            const cardSoldOut = cardRemaining <= 0;
            const shortPrice = `${Math.round(item.priceVnd / 1000)}k`;

            return (
              <div
                key={item.id}
                role="button"
                tabIndex={0}
                onClick={() => {
                  setActiveIndex(idx);
                  setOrderNotice("");
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setActiveIndex(idx);
                    setOrderNotice("");
                  }
                }}
                className={`group relative flex cursor-pointer flex-col justify-between rounded-[1.25rem] px-3 pb-3.5 pt-11 text-left text-white transition sm:px-4 sm:pt-12 ${
                  isSelected
                    ? "bg-[#1F2220] shadow-lg ring-2 ring-[#b85d43]"
                    : "bg-[#262928] opacity-95 shadow-sm hover:bg-[#1F2220]"
                }`}
              >
                {/* Đĩa tròn nhỏ gối lên mép trên card */}
                <div className="absolute -top-6 left-3 h-14 w-14 overflow-hidden rounded-full border-2 border-white/90 bg-[#171918] shadow-md transition group-hover:scale-105 sm:h-16 sm:w-16">
                  <Image
                    src={item.imageSrc}
                    alt={item.shortName}
                    width={128}
                    height={128}
                    unoptimized={item.imageSrc.endsWith(".svg")}
                    className="h-full w-full scale-[1.24] object-cover"
                  />
                </div>

                {/* Giá góc phải trên */}
                <span className="absolute right-3 top-3 text-base font-black tracking-tight text-white sm:text-lg">
                  {shortPrice}
                </span>

                <div>
                  <h2 className="line-clamp-1 text-sm font-extrabold text-white">
                    {item.shortName}
                  </h2>
                  <p className="mt-0.5 text-[11px] text-slate-300">
                    {cardSoldOut ? "Hết suất" : item.tagline}
                  </p>
                </div>

                <div className="mt-3 flex items-center justify-between gap-2 text-[11px] text-slate-300">
                  <span>{item.kcal} kcal</span>
                  <button
                    type="button"
                    aria-label={`Đặt món ${item.shortName}`}
                    disabled={cardSoldOut}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleOrderFeatured(item);
                    }}
                    className="grid h-6 w-6 place-items-center rounded-full bg-white/15 text-[10px] text-white transition hover:bg-orange-500 disabled:opacity-40"
                  >
                    ▶
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Chấm chỉ báo carousel phía dưới */}
        <div className="mt-5 flex items-center justify-center gap-2">
          {dishes.map((item, idx) => {
            const isSelected = idx === activeIndex;
            return (
              <button
                key={item.id}
                type="button"
                aria-label={`Xem món ${item.shortName}`}
                onClick={() => {
                  setActiveIndex(idx);
                  setOrderNotice("");
                }}
                className={`h-2 rounded-full transition-all ${
                  isSelected ? "w-5 bg-[#b85d43]" : "w-2 bg-[#b85d43]/30 hover:bg-[#b85d43]/60"
                }`}
              />
            );
          })}
          </div>
        </div>
      </div>
    </section>
  );
}

