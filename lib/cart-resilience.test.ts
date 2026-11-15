import { describe, expect, it } from "vitest";
import { sanitizeCartLine } from "./cart-store";
import { calcPortion } from "./nutrition";
import { formatVnd } from "./format";

describe("Cart Resilience & Legacy State Migration", () => {
  it("calcPortion handles undefined/null/NaN grams and macros safely without throwing", () => {
    // Should return zeroed macros instead of throwing unhandled exception
    expect(calcPortion(undefined, 0)).toEqual({ kcal: 0, protein: 0, carbs: 0, fat: 0 });
    expect(calcPortion(null, NaN)).toEqual({ kcal: 0, protein: 0, carbs: 0, fat: 0 });
    expect(calcPortion({ kcal: 200 }, -5)).toEqual({ kcal: 0, protein: 0, carbs: 0, fat: 0 });
    expect(calcPortion({ kcal: 100, protein: 10 }, 100)).toEqual({ kcal: 100, protein: 10, carbs: 0, fat: 0 });
  });

  it("formatVnd formats safely without returning NaNđ", () => {
    expect(formatVnd(NaN)).toBe("0đ");
    expect(formatVnd(undefined)).toBe("0đ");
    expect(formatVnd(null)).toBe("0đ");
    expect(formatVnd(75000)).toBe("75.000đ");
  });

  it("sanitizeCartLine safely migrates v1 legacy lines (having gramsPerPerson, missing grams)", () => {
    const legacyLine = {
      dish: {
        id: "dish-1",
        name: "Cá Hồi Nướng Teriyaki",
        price_vnd: 125000,
        yield_g: 350,
        nutrition_per100: { kcal: 210, protein: 22, carbs: 4, fat: 12 },
        min_g: 200,
        max_g: 600,
        step_g: 50,
      },
      gramsPerPerson: 250, // Old schema had no `grams`
    };

    const sanitized = sanitizeCartLine(legacyLine, 2);
    expect(sanitized).not.toBeNull();
    // 250 * 2 people = 500g
    expect(sanitized?.grams).toBe(500);
    expect(sanitized?.dish.id).toBe("dish-1");
    expect(sanitized?.dish.yield_g).toBe(350);
  });

  it("sanitizeCartLine handles corrupt or missing dish objects gracefully", () => {
    expect(sanitizeCartLine(null)).toBeNull();
    expect(sanitizeCartLine({})).toBeNull();
    expect(sanitizeCartLine({ dish: null })).toBeNull();
    expect(sanitizeCartLine({ dish: { id: "" } })).toBeNull();

    // Partial dish object gets safe defaults
    const partialDishLine = {
      dish: {
        id: "partial-dish",
        name: "Món phụ",
      },
    };
    const sanitized = sanitizeCartLine(partialDishLine, 1);
    expect(sanitized).not.toBeNull();
    expect(sanitized?.dish.name).toBe("Món phụ");
    expect(sanitized?.dish.yield_g).toBe(350);
    expect(sanitized?.dish.step_g).toBe(50);
    expect(sanitized?.dish.min_g).toBe(200);
    expect(sanitized?.grams).toBe(200);
  });
});

