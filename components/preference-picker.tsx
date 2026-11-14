"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useCartStore } from "@/lib/cart-store";
import type { Goal } from "@/lib/customer-menu";

const goals: Array<{ id: Goal; label: string; description: string }> = [
  {
    id: "balanced",
    label: "Cân bằng năng lượng",
    description: "Đủ tinh bột chậm, đạm sạch và rau củ cho cả buổi làm việc",
  },
  {
    id: "light",
    label: "Ít calories hơn",
    description: "Tăng nấm và rau xanh, giảm chất béo, nhẹ bụng sau khi ăn",
  },
  {
    id: "protein",
    label: "Giàu Protein",
    description: "Tập trung cá hồi & ức gà, no lâu và hỗ trợ phục hồi cơ bắp",
  },
  {
    id: "custom",
    label: "Tự điều chỉnh gram",
    description: "Tự ghép từng món và tùy biến lượng gram theo khẩu vị",
  },
];

export function PreferencePicker() {
  const router = useRouter();
  const people = useCartStore((state) => state.people);
  const goal = useCartStore((state) => state.goal);
  const lines = useCartStore((state) => state.lines);
  const setPeople = useCartStore((state) => state.setPeople);
  const setGoal = useCartStore((state) => state.setGoal);

  const [pendingCount, setPendingCount] = useState<number | null>(null);

  const handleSelectPeople = (count: number) => {
    if (count === people) return;
    const hasCustom = lines.some((l) => l.customEdited);
    if (hasCustom) {
      setPendingCount(count);
    } else {
      setPeople(count, true);
    }
  };

  return (
    <div className="space-y-8">
      {/* Bước 1: Chọn số người ăn */}
      <div>
        <div className="flex items-baseline justify-between gap-2 border-b border-white/20 pb-2.5">
          <h3 className="font-display text-xl font-bold text-white sm:text-2xl">
            1. Hôm nay có mấy người ăn?
          </h3>
          <span className="font-mono text-xs font-bold uppercase tracking-[0.16em] text-ivory/80">
            {people === 5 ? "5+ người" : `${people} người`}
          </span>
        </div>

        <div className="mt-3.5 grid grid-cols-5 gap-2">
          {[1, 2, 3, 4, 5].map((count) => {
            const active = people === count;
            return (
              <button
                key={count}
                type="button"
                aria-pressed={active}
                onClick={() => handleSelectPeople(count)}
                className={`flex min-h-[50px] items-center justify-center rounded-sm font-mono text-base font-bold transition-all focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-coral ${
                  active
                    ? "bg-coral text-white shadow-md ring-2 ring-white/80"
                    : "border border-white/25 bg-white/10 text-white hover:bg-white/20"
                }`}
              >
                {count === 5 ? "5+" : String(count).padStart(2, "0")}
              </button>
            );
          })}
        </div>

        {/* Hộp thoại hỏi ý kiến nếu khách đã sửa tay gram */}
        {pendingCount !== null && (
          <div className="mt-3 rounded border border-coral/40 bg-coral/10 p-3.5 text-xs text-white">
            <p className="font-bold text-coral">Cập nhật lại theo gợi ý mới?</p>
            <p className="mt-1 text-ivory/90 leading-relaxed">
              Bạn đã tùy chỉnh lượng gram cho món trong khay. Bạn muốn tính lại
              định lượng theo gợi ý chuẩn cho {pendingCount} người hay giữ
              nguyên số gram đã chỉnh tay?
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  setPeople(pendingCount, true);
                  setPendingCount(null);
                }}
                className="rounded bg-coral px-3 py-1.5 font-mono text-[11px] font-bold text-white shadow hover:bg-coral-hover"
              >
                Cập nhật theo gợi ý mới
              </button>
              <button
                type="button"
                onClick={() => {
                  setPeople(pendingCount, false);
                  setPendingCount(null);
                }}
                className="rounded border border-white/30 bg-white/10 px-3 py-1.5 font-mono text-[11px] font-bold text-white hover:bg-white/20"
              >
                Giữ nguyên lượng đã chỉnh
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Bước 2: Chọn mục tiêu dinh dưỡng */}
      <div>
        <div className="flex items-baseline justify-between gap-2 border-b border-white/20 pb-2.5">
          <h3 className="font-display text-xl font-bold text-white sm:text-2xl">
            2. Mục tiêu dinh dưỡng của bàn ăn
          </h3>
          <span className="font-mono text-xs font-bold uppercase tracking-[0.16em] text-coral">
            {goals.find((g) => g.id === goal)?.label ?? "Chưa chọn"}
          </span>
        </div>

        <div className="mt-3.5 grid gap-3 sm:grid-cols-2">
          {goals.map((item) => {
            const active = goal === item.id;
            return (
              <button
                key={item.id}
                type="button"
                aria-pressed={active}
                onClick={() => setGoal(item.id)}
                className={`relative flex min-h-[96px] flex-col justify-between rounded-sm border-2 p-4 text-left transition-all focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-coral ${
                  active
                    ? "border-coral bg-white text-forest shadow-md"
                    : "border-white/20 bg-forest-dark/70 text-white hover:border-white/40 hover:bg-forest-dark"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={`font-display text-base font-bold ${
                      active ? "text-forest" : "text-white"
                    }`}
                  >
                    {item.label}
                  </span>
                  <span
                    className={`rounded-sm px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider ${
                      active
                        ? "bg-coral text-white"
                        : "border border-white/20 text-white/70"
                    }`}
                  >
                    {active ? "Đang chọn ✓" : "Chọn"}
                  </span>
                </div>
                <span
                  className={`mt-2 text-xs leading-relaxed ${
                    active ? "text-ink/80 font-medium" : "text-white/75"
                  }`}
                >
                  {item.description}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Primary CTA nút lớn màu Coral Orange */}
      <button
        type="button"
        onClick={() => router.push("/menu")}
        className="w-full rounded-sm bg-coral py-4 font-mono text-xs font-bold uppercase tracking-[0.18em] text-white shadow-md transition-all hover:bg-coral-hover active:scale-[0.99] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
      >
        Xem gợi ý thực đơn cho {people === 5 ? "5+" : people} người →
      </button>
    </div>
  );
}
