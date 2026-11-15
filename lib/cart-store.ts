"use client";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Goal, MenuDish } from "./customer-menu";

export function roundToStep(grams: number, step_g: number): number {
  if (step_g <= 0) return Math.round(grams);
  return Math.round(grams / step_g) * step_g;
}

export function sanitizeCartLine(raw: unknown, people: number = 1): CartLine | null {
  if (!raw || typeof raw !== "object") return null;
  const line = raw as Record<string, unknown>;
  const dish = line.dish as Record<string, unknown> | undefined;
  if (!dish || typeof dish !== "object") return null;

  const id = String(dish.id || "");
  const name = String(dish.name || "");
  if (!id && !name) return null;

  const safePeople = Math.max(1, Math.min(10, Math.round(people || 1)));
  const minG = Number(dish.min_g) > 0 ? Number(dish.min_g) : 200;
  const maxG = Number(dish.max_g) >= minG ? Number(dish.max_g) : 500;
  const stepG = Number(dish.step_g) > 0 ? Number(dish.step_g) : 50;
  const yieldG = Number(dish.yield_g) > 0 ? Number(dish.yield_g) : 350;
  const priceVnd =
    Number(dish.price_vnd ?? dish.price) > 0
      ? Number(dish.price_vnd ?? dish.price)
      : 78000;

  const rawNutrition = (dish.nutrition_per100 ?? dish.nutrition) as
    | Record<string, unknown>
    | undefined;
  const nutritionPer100 = {
    kcal: Number(rawNutrition?.kcal) || 150,
    protein: Number(rawNutrition?.protein) || 15,
    carbs: Number(rawNutrition?.carbs) || 15,
    fat: Number(rawNutrition?.fat) || 5,
  };

  const safeDish: MenuDish = {
    id: id || name,
    name: name || "Món ăn",
    price_vnd: priceVnd,
    image_url: typeof dish.image_url === "string" ? dish.image_url : null,
    yield_g: yieldG,
    portion_limit: Number(dish.portion_limit) || 50,
    remaining_portions: Number(dish.remaining_portions ?? dish.portion_limit ?? 50),
    step_g: stepG,
    min_g: minG,
    max_g: maxG,
    nutrition_per100: nutritionPer100,
  };

  let rawG = Number(line.grams);
  if (!Number.isFinite(rawG) || rawG <= 0) {
    const perPerson = Number(line.gramsPerPerson);
    if (Number.isFinite(perPerson) && perPerson > 0) {
      rawG = perPerson * safePeople;
    } else {
      rawG = minG * safePeople;
    }
  }

  const clamped = Math.max(minG, Math.min(maxG * safePeople, roundToStep(rawG, stepG)));
  const baseGrams =
    Number(line.baseGrams) > 0 ? Number(line.baseGrams) : Math.round(clamped / safePeople);

  return {
    dish: safeDish,
    grams: clamped,
    customEdited: Boolean(line.customEdited),
    baseGrams,
    gramsPerPerson: Math.round(clamped / safePeople),
  };
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
          lines: lines
            .map((l) => sanitizeCartLine(l, state.people))
            .filter((l): l is CartLine => Boolean(l)),
        })),
      addDish: (dish, baseGrams) =>
        set((state) => {
          if (state.lines.some((l) => l.dish.id === dish.id)) return state;
          const minG = Number(dish.min_g) > 0 ? Number(dish.min_g) : 200;
          const maxG = Number(dish.max_g) >= minG ? Number(dish.max_g) : 500;
          const stepG = Number(dish.step_g) > 0 ? Number(dish.step_g) : 50;
          const base = baseGrams ?? minG;
          const suggested = roundToStep(base * state.people, stepG);
          const clamped = Math.max(
            minG,
            Math.min(maxG * state.people, suggested)
          );
          const newLine = sanitizeCartLine(
            {
              dish,
              grams: clamped,
              customEdited: false,
              baseGrams: base,
            },
            state.people
          );
          if (!newLine) return state;
          return {
            lines: [...state.lines, newLine],
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
    {
      name: "mhlh-cart",
      version: 2,
      migrate: (persistedState: unknown) => {
        if (!persistedState || typeof persistedState !== "object") {
          return { people: 1, goal: "balanced" as Goal, lines: [] };
        }
        const state = persistedState as Record<string, unknown>;
        const people = Math.max(1, Math.min(10, Math.round(Number(state.people) || 1)));
        const rawLines = Array.isArray(state.lines) ? state.lines : [];
        const lines = rawLines
          .map((l) => sanitizeCartLine(l, people))
          .filter((l): l is CartLine => Boolean(l));

        return {
          ...state,
          people,
          goal: (state.goal as Goal) || "balanced",
          lines,
        };
      },
      merge: (persistedState: unknown, currentState: CartState) => {
        if (!persistedState || typeof persistedState !== "object") {
          return currentState;
        }
        const state = persistedState as Record<string, unknown>;
        const people = Math.max(
          1,
          Math.min(10, Math.round(Number(state.people) || currentState.people || 1))
        );
        const rawLines = Array.isArray(state.lines) ? state.lines : [];
        const lines = rawLines
          .map((l) => sanitizeCartLine(l, people))
          .filter((l): l is CartLine => Boolean(l));

        return {
          ...currentState,
          ...state,
          people,
          goal: (state.goal as Goal) || currentState.goal || "balanced",
          lines,
        };
      },
    }
  )
);
