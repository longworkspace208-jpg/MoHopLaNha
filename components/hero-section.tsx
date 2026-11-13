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
  const [direction, setDirection] = useState<"next" | "prev">("next");
  const [transitionTick, setTransitionTick] = useState(0);
  const [liveMenuDishes, setLiveMenuDishes] = useState<Record<string, MenuDish>>({});
  const [orderNotice, setOrderNotice] = useState("");
  const [ordering, setOrdering] = useState(false);

  const active = dishes[activeIndex] ?? dishes[0];

  const selectDish = (nextIndex: number, explicitDirection?: "next" | "prev") => {
    if (dishes.length === 0) return;
    const normalized = ((nextIndex % dishes.length) + dishes.length) % dishes.length;
    if (normalized === activeIndex) return;
    setDirection(explicitDirection ?? (normalized > activeIndex ? "next" : "prev"));
    setTransitionTick((t) => t + 1);
    setActiveIndex(normalized);
    setOrderNotice("");
  };

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
        // Fallback giữ dữ liệu mặc định từ server
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
      className="relative w-full overflow-hidden border-b border-rule bg-ivory"
    >
      {/* Sân khấu Editorial Split-Screen */}
      <div className="relative mx-auto flex max-w-7xl flex-col lg:min-h-[620px] lg:flex-row">
        {/* Dải danh mục dọc bên trái phong cách tạp chí trên Desktop */}
        <aside className="hidden w-16 shrink-0 flex-col items-center justify-between border-r border-rule bg-ivory py-10 lg:flex">
          <span className="font-mono text-xs font-bold tracking-[0.22em] text-forest">
            {String(activeIndex + 1).padStart(2, "0")} / {String(dishes.length).padStart(2, "0")}
          </span>

          <div className="flex flex-col items-center gap-7">
            {dishes.map((item, idx) => {
              const isSelected = idx === activeIndex;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => selectDish(idx)}
                  style={{ writingMode: "vertical-rl" }}
                  className={`rotate-180 whitespace-nowrap py-1 font-mono text-xs font-bold uppercase tracking-[0.2em] transition-all ${
                    isSelected
                      ? "text-coral underline underline-offset-4 decoration-2"
                      : "text-muted hover:text-forest"
                  }`}
                  aria-pressed={isSelected}
                  aria-label={`Xem món ${item.title}`}
                >
                  {item.categoryLabel}
                </button>
              );
            })}
          </div>

          <span
            style={{ writingMode: "vertical-rl" }}
            className="rotate-180 font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-muted/70"
          >
            Mở Hộp Là Nhà
          </span>
        </aside>

        {/* Cột đĩa món ăn: Mảng nền Deep Forest Green tương phản cao, hình ảnh lớn làm tâm điểm */}
        <div className="relative flex flex-col items-center lg:w-[48%] lg:shrink-0">
          {/* Mảng nền Deep Forest Green */}
          <div className="w-full bg-forest px-4 pb-32 pt-6 text-ivory sm:px-6 lg:absolute lg:inset-y-0 lg:left-0 lg:w-[80%] lg:px-8 lg:pb-10 lg:pt-10">
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono text-xs font-bold uppercase tracking-[0.22em] text-ivory/80">
                Món trứ danh hôm nay
              </span>
              <span className="rounded-sm bg-coral px-2.5 py-0.5 font-mono text-[11px] font-bold uppercase tracking-wider text-white">
                {String(activeIndex + 1).padStart(2, "0")} / {String(dishes.length).padStart(2, "0")}
              </span>
            </div>

            {/* Thanh chọn nhanh danh mục dạng tab có gạch chân cam trên Mobile */}
            <div className="mt-4 flex gap-4 overflow-x-auto border-t border-white/15 pt-3.5 lg:hidden">
              {dishes.map((item, idx) => {
                const isSelected = idx === activeIndex;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => selectDish(idx)}
                    className={`shrink-0 border-b-2 pb-1.5 font-mono text-xs font-bold uppercase tracking-[0.16em] transition-colors ${
                      isSelected
                        ? "border-coral text-white font-extrabold"
                        : "border-transparent text-ivory/70 hover:text-white"
                    }`}
                  >
                    {item.categoryLabel}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Đĩa gốm tròn lớn, sắc nét, có chiều sâu, tương tác vắt qua ranh giới Forest / Ivory */}
          <div className="relative z-10 -mt-28 flex justify-center lg:my-auto lg:ml-20 lg:py-10">
            <div
              key={`${active.id}-${transitionTick}`}
              className={`relative h-64 w-64 overflow-hidden rounded-full border-4 border-white/80 bg-forest shadow-[0_24px_50px_rgba(23,63,50,0.35)] sm:h-80 sm:w-80 lg:h-[420px] lg:w-[420px] xl:h-[450px] xl:w-[450px] ${
                transitionTick > 0
                  ? direction === "prev"
                    ? "animate-hero-plate-prev"
                    : "animate-hero-plate-next"
                  : ""
              }`}
            >
              <Image
                src={active.imageSrc}
                alt={active.title}
                width={700}
                height={700}
                priority
                className="h-full w-full scale-[1.24] object-cover"
              />
            </div>
          </div>
        </div>

        {/* Cột thông tin món ăn: Phân cấp thị giác rõ ràng, font chữ cá tính, thông tin dễ đọc */}
        <div
          key={`copy-${active.id}-${transitionTick}`}
          className={`relative z-10 flex flex-1 flex-col justify-center px-4 pb-8 pt-6 sm:px-6 lg:py-14 lg:pl-12 lg:pr-10 ${
            transitionTick > 0 ? "animate-hero-copy" : ""
          }`}
        >
          {/* Tagline & Trạng thái suất còn */}
          <div className="flex flex-wrap items-center gap-3 font-mono text-xs font-bold uppercase tracking-[0.16em]">
            <span className="text-coral">
              ● {active.tagline}
            </span>
            <span className="text-rule font-normal">|</span>
            <span
              className={
                isSoldOut
                  ? "text-red-700 font-extrabold"
                  : remaining <= 5
                    ? "text-coral font-extrabold"
                    : "text-forest"
              }
            >
              {isSoldOut ? "Hết suất hôm nay" : `Còn ${remaining} suất`}
            </span>
          </div>

          {/* Tên món lớn, rõ ràng */}
          <h1 className="mt-3.5 font-display text-4xl font-bold leading-[1.08] tracking-tight text-forest sm:text-5xl lg:text-[54px]">
            {active.title}
          </h1>

          {/* Mô tả ngắn dễ đọc */}
          <p className="mt-3.5 max-w-lg text-base leading-relaxed text-ink/85 sm:text-lg">
            {active.description}
          </p>

          {/* Bảng định lượng 3 thông số rõ ràng */}
          <div className="mt-6 max-w-lg border-y border-rule py-4">
            <div className="grid grid-cols-3 divide-x divide-rule">
              <div className="pr-3">
                <span className="block font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-muted">
                  Định lượng
                </span>
                <span className="mt-1 block font-mono text-xl font-bold tabular-nums text-forest sm:text-2xl">
                  {active.grams}g
                </span>
                <span className="text-[11px] text-muted">suất chuẩn</span>
              </div>
              <div className="px-3 sm:px-4">
                <span className="block font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-muted">
                  Năng lượng
                </span>
                <span className="mt-1 block font-mono text-xl font-bold tabular-nums text-forest sm:text-2xl">
                  ~{active.kcal}
                </span>
                <span className="text-[11px] text-muted">kcal (ước tính)</span>
              </div>
              <div className="pl-3 sm:pl-4">
                <span className="block font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-muted">
                  Protein
                </span>
                <span className="mt-1 block font-mono text-xl font-bold tabular-nums text-coral sm:text-2xl">
                  ~{active.proteinG}g
                </span>
                <span className="text-[11px] text-muted">đạm sạch</span>
              </div>
            </div>
          </div>

          {/* Giá tiền nổi bật + Primary CTA cam rực rỡ + Secondary CTA xanh rừng */}
          <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between lg:max-w-lg">
            <div>
              <span className="block font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-muted">
                Giá món hôm nay
              </span>
              <p className="mt-0.5 font-display text-3xl font-bold tracking-tight text-coral sm:text-4xl">
                {formatVnd(active.priceVnd)}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                disabled={isSoldOut || ordering}
                onClick={() => handleOrderFeatured(active)}
                className="inline-flex min-h-[46px] items-center justify-center rounded-sm bg-coral px-7 py-3 font-mono text-xs font-bold uppercase tracking-[0.14em] text-white shadow-sm transition-all hover:bg-coral-hover active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-muted/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-coral"
              >
                {isSoldOut
                  ? "Hết suất hôm nay"
                  : ordering
                    ? "Đang thêm…"
                    : `Đặt ngay (${people === 5 ? "5+" : people} người)`}
              </button>

              <Link
                href="/menu"
                className="inline-flex min-h-[46px] items-center justify-center rounded-sm border-2 border-forest bg-transparent px-5 py-2.5 font-mono text-xs font-bold uppercase tracking-[0.14em] text-forest transition-colors hover:bg-forest hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest"
              >
                Tùy chỉnh gram →
              </Link>
            </div>
          </div>

          {orderNotice && (
            <p
              role="alert"
              className="mt-4 border-l-4 border-red-700 bg-white p-3 text-xs font-bold text-red-800"
            >
              {orderNotice}
            </p>
          )}
        </div>
      </div>

      {/* Dải 4 món trứ danh bên dưới: Có thumbnail, hover feedback, active state rõ ràng */}
      <div className="border-t border-rule bg-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-10">
          <div className="grid grid-cols-1 divide-y divide-rule sm:grid-cols-2 sm:divide-y-0 sm:gap-px sm:bg-rule lg:grid-cols-4">
            {dishes.map((item, idx) => {
              const isSelected = idx === activeIndex;
              const liveDish = liveMenuDishes[item.id] ?? item.fallbackMenuDish;
              const cardRemaining = liveDish.remaining_portions ?? liveDish.portion_limit;
              const cardSoldOut = cardRemaining <= 0;

              return (
                <div
                  key={item.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => selectDish(idx)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      selectDish(idx);
                    }
                  }}
                  className={`group relative flex cursor-pointer items-center gap-3.5 bg-white p-4 transition-all sm:p-5 ${
                    isSelected
                      ? "ring-2 ring-inset ring-coral bg-ivory/50"
                      : "hover:bg-ivory/30"
                  }`}
                  aria-pressed={isSelected}
                  aria-label={`Chọn món ${item.shortName}`}
                >
                  <div
                    className={`relative h-16 w-16 shrink-0 overflow-hidden rounded-full border-2 transition-transform duration-200 group-hover:scale-105 ${
                      isSelected
                        ? "border-coral shadow-sm"
                        : "border-forest/30"
                    }`}
                  >
                    <Image
                      src={item.imageSrc}
                      alt={item.shortName}
                      width={140}
                      height={140}
                      className="h-full w-full scale-[1.24] object-cover"
                    />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-1.5">
                      <span className="font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-muted">
                        {String(idx + 1).padStart(2, "0")} · {item.kcal} kcal
                      </span>
                      <span className="font-mono text-xs font-bold text-coral">
                        {formatVnd(item.priceVnd)}
                      </span>
                    </div>

                    <h2
                      className={`mt-0.5 truncate font-display text-base font-bold transition-colors ${
                        isSelected ? "text-coral" : "text-forest group-hover:text-coral"
                      }`}
                    >
                      {item.shortName}
                    </h2>

                    <div className="mt-1 flex items-center justify-between gap-2">
                      <span className="text-xs text-muted">
                        {cardSoldOut ? "Hết suất" : item.tagline}
                      </span>
                      <span
                        className={`font-mono text-[11px] font-bold uppercase tracking-wider transition-colors ${
                          isSelected ? "text-coral font-extrabold" : "text-forest group-hover:text-coral"
                        }`}
                      >
                        {isSelected ? "Đang xem" : "Xem →"}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Thanh chuyển slide & pagination dot rõ ràng */}
          <div className="flex items-center justify-between border-t border-rule py-3.5 font-mono text-xs font-bold uppercase tracking-[0.16em] text-forest">
            <button
              type="button"
              aria-label="Món trước"
              onClick={() => selectDish(activeIndex - 1, "prev")}
              className="inline-flex min-h-[36px] items-center gap-1.5 py-1 text-forest transition-colors hover:text-coral focus-visible:outline-2 focus-visible:outline-coral"
            >
              ← <span className="hidden sm:inline">Món trước</span>
            </button>

            <div className="flex items-center gap-2.5">
              {dishes.map((item, idx) => {
                const isSelected = idx === activeIndex;
                return (
                  <button
                    key={item.id}
                    type="button"
                    aria-label={`Xem món ${item.shortName}`}
                    aria-current={isSelected ? "true" : undefined}
                    onClick={() => selectDish(idx)}
                    className={`h-2 rounded-full transition-all ${
                      isSelected
                        ? "w-8 bg-coral"
                        : "w-2.5 bg-forest/25 hover:bg-forest/60"
                    }`}
                  />
                );
              })}
            </div>

            <button
              type="button"
              aria-label="Món tiếp theo"
              onClick={() => selectDish(activeIndex + 1, "next")}
              className="inline-flex min-h-[36px] items-center gap-1.5 py-1 text-forest transition-colors hover:text-coral focus-visible:outline-2 focus-visible:outline-coral"
            >
              <span className="hidden sm:inline">Món tiếp theo</span> →
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
