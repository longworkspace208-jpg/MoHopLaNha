"use client";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Goal, MenuDish } from "./customer-menu";

export function roundToStep(grams: number, step_g: number): number {
  if (step_g <= 0) return Math.round(grams);
  return Math.round(grams / step_g) * step_g;
}

export type CartLine = {
  dish: MenuDish;
  grams: number; // Tổng lượng khách đặt cho món này (không nhân số người ở bất kỳ bước nào)
  customEdited?: boolean; // Khách đã tự tay chỉnh gram chưa
  baseGrams?: number; // Định lượng 1 suất theo mục tiêu ban đầu
  gramsPerPerson?: number; // Thuộc tính tương thích ngược
};

type CartState = {
  people: number;
  goal: Goal;
  lines: CartLine[];
  setPeople: (people: number, recalculateSuggested?: boolean) => void;
  setGoal: (goal: Goal) => void;
  setLines: (lines: CartLine[]) => void;
  addDish: (dish: MenuDish, baseGrams?: number) => void;
  changeGrams: (dishId: string, grams: number, isManualEdit?: boolean) => void;
  removeDish: (dishId: string) => void;
  clearCart: () => void;
  resetToSuggestions: () => void;
};

export const useCartStore = create<CartState>()(
  persist(
    (set) => ({
      people: 1,
      goal: "balanced",
      lines: [],
      setPeople: (people, recalculateSuggested = false) =>
        set((state) => {
          const p = Math.max(1, Math.min(10, Math.round(people || 1)));
          const updatedLines = state.lines.map((line) => {
            if (recalculateSuggested || !line.customEdited) {
              const base = line.baseGrams ?? line.dish.min_g;
              const suggested = roundToStep(base * p, line.dish.step_g);
              const clamped = Math.max(
                line.dish.min_g,
                Math.min(line.dish.max_g * p, suggested)
              );
              return {
                ...line,
                grams: clamped,
                customEdited: false,
                gramsPerPerson: Math.round(clamped / p),
              };
            }
            // Nếu khách đã chỉnh tay và chọn giữ nguyên:
            // Chỉ cần clamp trong khoảng min_g .. max_g * p
            const clamped = Math.max(
              line.dish.min_g,
              Math.min(line.dish.max_g * p, line.grams)
            );
            return {
              ...line,
              grams: clamped,
              gramsPerPerson: Math.round(clamped / p),
            };
          });
          return { people: p, lines: updatedLines };
        }),
      setGoal: (goal) => set({ goal }),
      setLines: (lines) =>
        set((state) => ({
          lines: lines.map((l) => {
            const rawGrams =
              typeof l.grams === "number"
                ? l.grams
                : typeof l.gramsPerPerson === "number"
                  ? l.gramsPerPerson * state.people
                  : l.dish.min_g;
            return {
              dish: l.dish,
              grams: rawGrams,
              customEdited: l.customEdited ?? false,
              baseGrams: l.baseGrams ?? Math.round(rawGrams / state.people),
              gramsPerPerson: Math.round(rawGrams / state.people),
            };
          }),
        })),
      addDish: (dish, baseGrams) =>
        set((state) => {
          if (state.lines.some((l) => l.dish.id === dish.id)) return state;
          const base = baseGrams ?? dish.min_g;
          const suggested = roundToStep(base * state.people, dish.step_g);
          const clamped = Math.max(
            dish.min_g,
            Math.min(dish.max_g * state.people, suggested)
          );
          return {
            lines: [
              ...state.lines,
              {
                dish,
                grams: clamped,
                customEdited: false,
                baseGrams: base,
                gramsPerPerson: Math.round(clamped / state.people),
              },
            ],
          };
        }),
      changeGrams: (dishId, newGrams, isManualEdit = true) =>
        set((state) => ({
          lines: state.lines.map((line) => {
            if (line.dish.id !== dishId) return line;
            const minG = line.dish.min_g;
            const maxG = line.dish.max_g * state.people;
            const clamped = Math.max(minG, Math.min(maxG, newGrams));
            return {
              ...line,
              grams: clamped,
              customEdited: isManualEdit ? true : line.customEdited,
              gramsPerPerson: Math.round(clamped / state.people),
            };
          }),
        })),
      removeDish: (dishId) =>
        set((state) => ({
          lines: state.lines.filter((line) => line.dish.id !== dishId),
        })),
      clearCart: () => set({ lines: [] }),
      resetToSuggestions: () =>
        set((state) => ({
          lines: state.lines.map((line) => {
            const base = line.baseGrams ?? line.dish.min_g;
            const suggested = roundToStep(base * state.people, line.dish.step_g);
            const clamped = Math.max(
              line.dish.min_g,
              Math.min(line.dish.max_g * state.people, suggested)
            );
            return {
              ...line,
              grams: clamped,
              customEdited: false,
              gramsPerPerson: Math.round(clamped / state.people),
            };
          }),
        })),
    }),
    { name: "mhlh-cart" }
  )
);
