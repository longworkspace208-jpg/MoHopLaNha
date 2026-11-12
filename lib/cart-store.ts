"use client";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Goal, MenuDish } from "./customer-menu";

export type CartLine = { dish: MenuDish; gramsPerPerson: number };

type CartState = {
  people: number;
  goal: Goal;
  lines: CartLine[];
  setPeople: (people: number) => void;
  setGoal: (goal: Goal) => void;
  setLines: (lines: CartLine[]) => void;
  addDish: (dish: MenuDish) => void;
  changeGrams: (dishId: string, gramsPerPerson: number) => void;
  removeDish: (dishId: string) => void;
  clearCart: () => void;
};

export const useCartStore = create<CartState>()(
  persist(
    (set) => ({
      people: 1,
      goal: "balanced",
      lines: [],
      setPeople: (people) => set({ people }),
      setGoal: (goal) => set({ goal }),
      setLines: (lines) => set({ lines }),
      addDish: (dish) =>
        set((state) =>
          state.lines.some((line) => line.dish.id === dish.id)
            ? state
            : { lines: [...state.lines, { dish, gramsPerPerson: dish.min_g }] }
        ),
      changeGrams: (dishId, gramsPerPerson) =>
        set((state) => ({
          lines: state.lines.map((line) =>
            line.dish.id === dishId
              ? {
                  ...line,
                  gramsPerPerson: Math.max(
                    line.dish.min_g,
                    Math.min(line.dish.max_g, gramsPerPerson)
                  )
                }
              : line
          )
        })),
      removeDish: (dishId) =>
        set((state) => ({
          lines: state.lines.filter((line) => line.dish.id !== dishId)
        })),
      clearCart: () => set({ lines: [] })
    }),
    { name: "mhlh-cart" }
  )
);
