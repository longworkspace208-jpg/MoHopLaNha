"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Goal, MenuDish } from "@/lib/customer-menu";
import { useCartStore } from "@/lib/cart-store";
import { formatVnd } from "@/lib/format";

export type RetentionDishItem = {
  id: string;
  name: string;
  imageSrc: string;
  priceVnd: number;
  grams: number;
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  allergens: string[];
  ingredientsSummary: string;
  recommendedFor: Exclude<Goal, "custom">[];
  menuDish: MenuDish;
};

const GOAL_TABS: Array<{
  id: Exclude<Goal, "custom">;
  label: string;
  code: string;
  summary: string;
  idealNote: string;
}> = [
  {
    id: "balanced",
    label: "Cân bằng hàng ngày",
    code: "MỤC TIÊU 01 · CÂN BẰNG",
    summary:
      "Phối hợp tinh bột chậm từ gạo lứt và khoai lang cùng đạm sạch, giữ năng lượng ổn định suốt buổi làm việc.",
    idealNote: "Phù hợp duy trì nhịp ăn sạch 3–5 bữa mỗi tuần.",
  },
  {
    id: "light",
    label: "Nhẹ bụng · Ít kcal",
    code: "MỤC TIÊU 02 · THANH NHẸ",
    summary:
      "Tăng tỷ trọng rau củ, nấm và đạm thanh nhẹ, tiết chế chất béo bão hòa nhưng vẫn giữ trọn hương vị cơm nhà.",
    idealNote: "Phù hợp bữa tối nhẹ nhàng hoặc ngày ít vận động.",
  },
  {
    id: "protein",
    label: "Giàu Protein",
    code: "MỤC TIÊU 03 · GIÀU ĐẠM",
    summary:
      "Ưu tiên cá hồi áp chảo và ức gà nướng thảo mộc giúp đạt ngưỡng protein cao trên mỗi suất chuẩn 350g.",
    idealNote: "Phù hợp người tập luyện hoặc cần no lâu không xế chiều.",
  },
];

const TRANSPARENCY_STEPS = [
  {
    step: "01",
    title: "Nấu mới theo mẻ & mã lô nguyên liệu",
    detail:
      "Mỗi món được chế biến theo mẻ trong ngày, ghi nhận mã lô (lot_code) và nguồn nguyên liệu thực tế trước khi chia suất.",
    highlightLabel: "Mã lô & nguồn gốc mẻ nấu",
    highlightValue: "LOT-CAHOI-HOMNAY · Cá hồi Na Uy tươi, khoai nghiền, măng tây",
  },
  {
    step: "02",
    title: "Cân gram thực tế từng hộp lúc đóng gói",
    detail:
      "Bếp đối chiếu đúng định lượng khách đặt và chốt cân nặng thực tế ngay khi đóng hộp, khóa snapshot vĩnh viễn.",
    highlightLabel: "Định lượng thực tế đã cân",
    highlightValue: "350g thực tế · Số liệu bất biến sau thời điểm đóng gói",
  },
  {
    step: "03",
    title: "Quét QR trên nắp hộp xem dinh dưỡng",
    detail:
      "Tem QR dẫn thẳng tới trang truy xuất riêng: kcal, P/C/F ước tính, chất gây dị ứng, giờ đóng gói và tuyệt đối không chứa thông tin cá nhân.",
    highlightLabel: "Truy xuất Nutrition QR (/n/[code])",
    highlightValue: "Công khai minh bạch · Không lưu họ tên hay SĐT người đặt",
  },
];

const FAQS = [
  {
    q: "Chỉ số calories và macro trên hộp được tính thế nào?",
    a: "Giá trị kcal, Protein, Carbs và Fat được tính theo công thức định chuẩn trên từng 100g thành phẩm nhân với số gram cân thực tế lúc đóng gói, đồng thời ghi chú rõ là số liệu ước tính.",
  },
  {
    q: "Tôi có thể tăng giảm lượng gram từng món theo sức ăn không?",
    a: "Có. Tại trang Thực đơn (/menu), mỗi món cho phép tăng hoặc giảm theo bước gram cấu hình (ví dụ 200g đến 500g), hệ thống tự tính lại giá và macro tương ứng.",
  },
  {
    q: "Quy trình đặt đơn và thanh toán VietQR diễn ra ra sao?",
    a: "Sau khi xác nhận địa chỉ thuộc vùng phục vụ tại trang Thanh toán, bạn quét mã VietQR theo đúng mã đơn MHLN#### và bấm 'Tôi đã chuyển khoản'. Trạng thái đơn được cập nhật liên tục tại trang theo dõi riêng.",
  },
  {
    q: "Người dị ứng hải sản hoặc đậu nành kiểm tra ở đâu?",
    a: "Mỗi món đều liệt kê chất gây dị ứng từ công thức nguyên liệu (như Cá hoặc Đậu nành) và hiển thị rõ ngay trên tem Nutrition QR sau khi đóng gói.",
  },
];

export function HomeGoalShowcase({ dishes }: { dishes: RetentionDishItem[] }) {
  const router = useRouter();
  const setGoal = useCartStore((state) => state.setGoal);
  const addDish = useCartStore((state) => state.addDish);

  const [selectedGoal, setSelectedGoal] =
    useState<Exclude<Goal, "custom">>("balanced");
  const [goalTick, setGoalTick] = useState(0);
  const [addedDishId, setAddedDishId] = useState<string | null>(null);

  const activeGoalMeta =
    GOAL_TABS.find((t) => t.id === selectedGoal) ?? GOAL_TABS[0];

  const matchingDishes = dishes.filter((d) =>
    d.recommendedFor.includes(selectedGoal)
  );
  const shownDishes =
    matchingDishes.length > 0 ? matchingDishes : dishes.slice(0, 3);

  const handleSelectGoal = (goalId: Exclude<Goal, "custom">) => {
    if (goalId === selectedGoal) return;
    setSelectedGoal(goalId);
    setGoalTick((t) => t + 1);
  };

  const handleApplyGoalToMenu = () => {
    setGoal(selectedGoal);
    router.push("/menu");
  };

  const handleQuickAdd = (dish: RetentionDishItem) => {
    addDish({
      ...dish.menuDish,
      image_url: dish.imageSrc,
    });
    setAddedDishId(dish.id);
  };

  return (
    <section
      aria-labelledby="goal-explorer-heading"
      className="border-y border-rule bg-white py-14 sm:py-20"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-10">
        {/* Header biên tập + Tab chọn mục tiêu rõ ràng */}
        <div className="flex flex-col gap-6 border-b border-rule pb-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-xl">
            <span className="font-mono text-xs font-bold uppercase tracking-[0.2em] text-coral">
              Khẩu phần theo mục tiêu
            </span>
            <h2
              id="goal-explorer-heading"
              className="mt-2 font-display text-3xl font-bold leading-tight tracking-tight text-forest sm:text-4xl"
            >
              Thực đơn gợi ý theo thể trạng hôm nay
            </h2>
          </div>

          {/* Tab bar có trạng thái active viền Coral cực kỳ rõ */}
          <div
            role="tablist"
            aria-label="Mục tiêu dinh dưỡng"
            className="flex gap-4 overflow-x-auto pb-1"
          >
            {GOAL_TABS.map((tab) => {
              const isActive = tab.id === selectedGoal;
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => handleSelectGoal(tab.id)}
                  className={`shrink-0 rounded-sm px-4 py-2.5 font-mono text-xs font-bold uppercase tracking-[0.14em] transition-all focus-visible:outline-2 focus-visible:outline-coral ${
                    isActive
                      ? "bg-coral text-white shadow-sm"
                      : "border border-forest/20 bg-ivory/50 text-forest hover:border-forest hover:bg-ivory"
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Nội dung chuyển mượt khi đổi tab */}
        <div
          key={`${selectedGoal}-${goalTick}`}
          className={goalTick > 0 ? "animate-panel-enter" : ""}
        >
          {/* Thanh mô tả mục tiêu + CTA phụ */}
          <div className="flex flex-col justify-between gap-4 border-b border-rule py-5 sm:flex-row sm:items-center">
            <div className="max-w-2xl space-y-1">
              <span className="font-mono text-xs font-bold uppercase tracking-[0.16em] text-forest">
                {activeGoalMeta.code} · {activeGoalMeta.idealNote}
              </span>
              <p className="text-sm leading-relaxed text-ink/85">
                {activeGoalMeta.summary}
              </p>
            </div>
            <button
              type="button"
              onClick={handleApplyGoalToMenu}
              className="inline-flex min-h-[42px] shrink-0 items-center justify-center rounded-sm border-2 border-forest bg-white px-5 py-2 font-mono text-xs font-bold uppercase tracking-[0.14em] text-forest transition-colors hover:bg-forest hover:text-white focus-visible:outline-2 focus-visible:outline-coral"
            >
              Áp dụng &amp; Xem thực đơn →
            </button>
          </div>

          {/* Dải kể chuyện ngang trên mobile/tablet, lưới biên tập trên desktop */}
          <div className="mt-8 flex snap-x gap-6 overflow-x-auto pb-4 lg:grid lg:grid-cols-3 lg:gap-8 lg:overflow-visible lg:pb-0">
            {shownDishes.map((dish, idx) => {
              const totalMacros = Math.max(
                1,
                dish.proteinG + dish.carbsG + dish.fatG
              );
              const proteinPct = Math.round((dish.proteinG / totalMacros) * 100);
              const carbsPct = Math.round((dish.carbsG / totalMacros) * 100);
              const fatPct = Math.max(0, 100 - proteinPct - carbsPct);
              const justAdded = addedDishId === dish.id;

              return (
                <article
                  key={dish.id}
                  className="group flex w-[84vw] max-w-sm shrink-0 snap-start flex-col justify-between rounded-sm border border-rule bg-ivory/40 p-4 transition-all hover:border-forest/40 hover:bg-white hover:shadow-soft sm:w-[360px] lg:w-auto lg:max-w-none lg:p-5"
                >
                  <div>
                    <div className="relative aspect-[4/3] w-full overflow-hidden rounded-sm bg-forest">
                      <Image
                        src={dish.imageSrc}
                        alt={dish.name}
                        width={640}
                        height={480}
                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                      <span className="absolute left-2.5 top-2.5 rounded-sm bg-forest/90 px-2.5 py-1 font-mono text-[11px] font-bold tracking-wider text-white">
                        NO. {String(idx + 1).padStart(2, "0")}
                      </span>
                    </div>

                    <div className="mt-4 flex items-baseline justify-between gap-3">
                      <h3 className="font-display text-xl font-bold text-forest">
                        {dish.name}
                      </h3>
                      <span className="shrink-0 font-mono text-base font-bold tabular-nums text-coral">
                        {formatVnd(dish.priceVnd)}
                      </span>
                    </div>

                    <p className="mt-1 font-mono text-xs font-bold uppercase tracking-[0.12em] text-muted">
                      Suất {dish.grams}g · ~{dish.kcal} kcal (ước tính)
                    </p>

                    {/* Thước đo macro 3 phần màu rõ ràng */}
                    <div className="mt-3.5 space-y-1.5">
                      <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-rule">
                        <div
                          style={{ width: `${proteinPct}%` }}
                          className="bg-forest"
                          title={`Protein ${dish.proteinG}g`}
                        />
                        <div
                          style={{ width: `${carbsPct}%` }}
                          className="bg-muted"
                          title={`Carbs ${dish.carbsG}g`}
                        />
                        <div
                          style={{ width: `${fatPct}%` }}
                          className="bg-coral"
                          title={`Fat ${dish.fatG}g`}
                        />
                      </div>
                      <div className="flex items-center justify-between font-mono text-xs font-bold tabular-nums text-ink">
                        <span>Protein: {dish.proteinG}g</span>
                        <span>Carbs: {dish.carbsG}g</span>
                        <span>Fat: {dish.fatG}g</span>
                      </div>
                    </div>

                    <p className="mt-3 text-xs leading-relaxed text-muted">
                      Nguyên liệu: <strong className="text-ink">{dish.ingredientsSummary}</strong>
                      {dish.allergens.length > 0 && (
                        <span className="mt-1 block font-bold text-coral">
                          Dị ứng: {dish.allergens.join(", ")}
                        </span>
                      )}
                    </p>
                  </div>

                  {/* Nút bấm tương tác rõ ràng */}
                  <div className="mt-5 flex items-center justify-between gap-3 border-t border-rule pt-4">
                    <button
                      type="button"
                      onClick={() => handleQuickAdd(dish)}
                      className={`inline-flex min-h-[42px] flex-1 items-center justify-center rounded-sm px-4 py-2 font-mono text-xs font-bold uppercase tracking-[0.14em] transition-all focus-visible:outline-2 focus-visible:outline-coral ${
                        justAdded
                          ? "bg-forest text-white"
                          : "bg-coral text-white hover:bg-coral-hover active:scale-[0.98]"
                      }`}
                    >
                      {justAdded ? "✓ Đã thêm vào giỏ" : "+ Thêm suất chuẩn"}
                    </button>

                    {justAdded ? (
                      <Link
                        href="/cart"
                        className="inline-flex min-h-[42px] items-center justify-center rounded-sm border-2 border-forest px-3.5 py-1.5 font-mono text-xs font-bold uppercase tracking-[0.12em] text-forest transition-colors hover:bg-forest hover:text-white"
                      >
                        Mở giỏ →
                      </Link>
                    ) : (
                      <Link
                        href="/menu"
                        className="inline-flex min-h-[42px] items-center justify-center px-2 font-mono text-xs font-bold uppercase tracking-[0.12em] text-forest underline hover:text-coral"
                      >
                        Đổi gram
                      </Link>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

export function HomeTraceabilityAndFaq({
  primaryDish,
}: {
  primaryDish?: RetentionDishItem;
}) {
  const [activeStep, setActiveStep] = useState(0);
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  const currentStep = TRANSPARENCY_STEPS[activeStep] ?? TRANSPARENCY_STEPS[0];

  return (
    <>
      {/* Quy trình kiểm soát định lượng & Phiếu tem mẫu */}
      <section
        id="quy-trinh-qr"
        aria-labelledby="transparency-heading"
        className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-10"
      >
        <div className="grid gap-10 lg:grid-cols-12 lg:items-start">
          {/* Cột trái: 3 công đoạn tương tác */}
          <div className="lg:col-span-7">
            <span className="font-mono text-xs font-bold uppercase tracking-[0.2em] text-coral">
              Kỷ luật bếp nấu
            </span>
            <h2
              id="transparency-heading"
              className="mt-2 font-display text-3xl font-bold leading-tight tracking-tight text-forest sm:text-4xl"
            >
              Từ mẻ nấu trong bếp đến tem QR trên nắp hộp
            </h2>
            <p className="mt-3 max-w-xl text-base leading-relaxed text-ink/80">
              Nhấn vào từng công đoạn để xem quy trình Mở Hộp Là Nhà cân gram thực tế và bảo đảm nguồn gốc nguyên liệu.
            </p>

            <div className="mt-8 divide-y divide-rule border-y border-rule">
              {TRANSPARENCY_STEPS.map((item, idx) => {
                const active = idx === activeStep;
                return (
                  <button
                    key={item.step}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setActiveStep(idx)}
                    className={`flex w-full items-start gap-5 border-l-4 py-5 pl-5 pr-3 text-left transition-all focus-visible:outline-2 focus-visible:outline-coral ${
                      active
                        ? "border-l-coral bg-white shadow-xs"
                        : "border-l-transparent hover:bg-white/60"
                    }`}
                  >
                    <span
                      className={`font-mono text-base font-bold ${
                        active ? "text-coral" : "text-muted"
                      }`}
                    >
                      {item.step}
                    </span>
                    <div>
                      <p
                        className={`font-display text-xl font-bold transition-colors ${
                          active ? "text-forest" : "text-ink"
                        }`}
                      >
                        {item.title}
                      </p>
                      <p className="mt-1 text-sm leading-relaxed text-muted">
                        {item.detail}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Cột phải: Phiếu dinh dưỡng mẫu phong cách tem in ấn */}
          <div className="rounded-sm border-2 border-forest bg-white p-6 shadow-soft sm:p-8 lg:col-span-5">
            <div className="flex items-start justify-between gap-4 border-b-2 border-forest pb-4">
              <div>
                <p className="font-mono text-[11px] font-bold uppercase tracking-[0.18em] text-coral">
                  Mẫu tem dinh dưỡng (/n/[code])
                </p>
                <h3 className="mt-1 font-display text-2xl font-bold text-forest">
                  {primaryDish?.name ?? "Cá hồi áp chảo sốt chanh"}
                </h3>
              </div>
              <span className="rounded-sm bg-forest px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-wider text-white">
                QR SNAPSHOT
              </span>
            </div>

            <div
              key={currentStep.step}
              className="animate-panel-enter mt-4 border-l-4 border-coral bg-ivory p-4"
            >
              <p className="font-mono text-xs font-bold uppercase tracking-[0.14em] text-forest">
                Công đoạn {currentStep.step} · {currentStep.highlightLabel}
              </p>
              <p className="mt-1 text-xs font-semibold leading-relaxed text-ink">
                {currentStep.highlightValue}
              </p>
            </div>

            {primaryDish && (
              <dl className="mt-4 divide-y divide-rule font-mono text-xs">
                <div className="flex items-baseline justify-between py-3">
                  <dt className="font-bold uppercase tracking-[0.12em] text-muted">
                    Định lượng cân thực tế
                  </dt>
                  <dd className="text-lg font-bold tabular-nums text-coral">
                    {primaryDish.grams}g
                  </dd>
                </div>
                <div className="flex items-baseline justify-between py-3">
                  <dt className="font-bold uppercase tracking-[0.12em] text-muted">
                    Năng lượng (ước tính)
                  </dt>
                  <dd className="text-base font-bold tabular-nums text-forest">
                    ~{primaryDish.kcal} kcal
                  </dd>
                </div>
                <div className="flex items-baseline justify-between py-3">
                  <dt className="font-bold uppercase tracking-[0.12em] text-muted">
                    Protein / Carbs / Fat
                  </dt>
                  <dd className="font-bold tabular-nums text-ink">
                    {primaryDish.proteinG}g / {primaryDish.carbsG}g / {primaryDish.fatG}g
                  </dd>
                </div>
                <div className="flex items-baseline justify-between gap-4 py-3">
                  <dt className="shrink-0 font-bold uppercase tracking-[0.12em] text-muted">
                    Chất gây dị ứng
                  </dt>
                  <dd className="text-right font-bold text-coral">
                    {primaryDish.allergens.length > 0
                      ? primaryDish.allergens.join(", ")
                      : "Không ghi nhận"}
                  </dd>
                </div>
              </dl>
            )}

            <p className="mt-4 border-t border-forest/20 pt-3 text-xs leading-relaxed text-muted">
              Thành phần: {primaryDish?.ingredientsSummary || "Cá hồi Na Uy tươi, khoai lang, rau củ áp chảo"}. Dữ liệu snapshot được khóa vĩnh viễn lúc đóng hộp, tuyệt đối không lưu thông tin cá nhân khách hàng.
            </p>
          </div>
        </div>
      </section>

      {/* FAQ Hỏi đáp dạng Accordion */}
      <section
        aria-labelledby="faq-heading"
        className="border-t border-rule bg-white py-16 sm:py-20"
      >
        <div className="mx-auto grid max-w-7xl gap-10 px-4 sm:px-6 lg:grid-cols-12 lg:px-10">
          <div className="lg:col-span-4">
            <span className="font-mono text-xs font-bold uppercase tracking-[0.2em] text-coral">
              Giải đáp thắc mắc
            </span>
            <h2
              id="faq-heading"
              className="mt-2 font-display text-3xl font-bold leading-tight text-forest sm:text-4xl"
            >
              Minh bạch trước khi bạn đặt bữa đầu tiên
            </h2>
            <p className="mt-3 text-base leading-relaxed text-ink/80">
              Mọi điều bạn cần biết về cân khẩu phần, vùng phục vụ nội thành và thanh toán VietQR.
            </p>
          </div>

          <div className="divide-y divide-rule border-y border-rule lg:col-span-8">
            {FAQS.map((item, idx) => {
              const isOpen = openFaq === idx;
              return (
                <div key={item.q}>
                  <button
                    type="button"
                    aria-expanded={isOpen}
                    onClick={() => setOpenFaq(isOpen ? null : idx)}
                    className="flex w-full items-center justify-between gap-4 py-5 text-left transition-colors hover:text-coral focus-visible:outline-2 focus-visible:outline-coral"
                  >
                    <span className="font-display text-lg font-bold text-forest sm:text-xl">
                      {item.q}
                    </span>
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-sm border border-forest/30 font-mono text-lg font-bold text-forest">
                      {isOpen ? "−" : "+"}
                    </span>
                  </button>
                  {isOpen && (
                    <div className="animate-panel-enter pb-5 pr-8 text-base leading-relaxed text-ink/85">
                      {item.a}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Mảng kết trang Deep Forest Green */}
      <section className="bg-forest py-16 text-white sm:py-20">
        <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-8 px-4 sm:px-6 lg:flex-row lg:items-end lg:px-10">
          <div className="max-w-2xl">
            <span className="font-mono text-xs font-bold uppercase tracking-[0.22em] text-coral">
              Mở Hộp Là Nhà · Đặt bữa hôm nay
            </span>
            <h2 className="mt-3 font-display text-3xl font-bold leading-tight tracking-tight sm:text-5xl">
              Cơm nhà nấu mới mỗi ngày,{" "}
              <span className="font-normal italic text-coral">cân đủ từng gram</span>{" "}
              cho cả bàn ăn.
            </h2>
          </div>

          <div className="flex w-full flex-col gap-3.5 sm:w-auto sm:flex-row">
            <Link
              href="/menu"
              className="inline-flex min-h-[48px] items-center justify-center whitespace-nowrap rounded-sm bg-coral px-8 py-3.5 text-center font-mono text-xs font-bold uppercase tracking-[0.16em] text-white shadow-md transition-colors hover:bg-coral-hover focus-visible:outline-2 focus-visible:outline-white"
            >
              Xem thực đơn hôm nay
            </Link>
            <Link
              href="/cart"
              className="inline-flex min-h-[48px] items-center justify-center whitespace-nowrap rounded-sm border-2 border-white/60 px-7 py-3.5 text-center font-mono text-xs font-bold uppercase tracking-[0.16em] text-white transition-colors hover:border-white hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-white"
            >
              Kiểm tra giỏ hàng
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
