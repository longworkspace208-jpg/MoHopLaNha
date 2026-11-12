import { describe, expect, it } from "vitest";
import { calcDish, calcPortion } from "./nutrition";

describe("nutrition calculations", () => {
  it("calculates thịt kho per 100 g cooked output by formula", () => {
    const result = calcDish([
      { raw_g: 500, per100: { kcal: 242, protein: 27, carbs: 0, fat: 14 } },
      { raw_g: 50, per100: { kcal: 387, protein: 0, carbs: 100, fat: 0 } }
    ], 400);
    expect(result).toEqual({ kcal: 350.875, protein: 33.75, carbs: 12.5, fat: 17.5 });
  });
  it("calculates one portion from a per-100-g profile", () => {
    expect(calcPortion({ kcal: 350.875, protein: 33.75, carbs: 12.5, fat: 17.5 }, 150)).toEqual({ kcal: 526.3125, protein: 50.625, carbs: 18.75, fat: 26.25 });
  });
});
