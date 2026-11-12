import type { Macros } from "./nutrition";
export type Goal = "balanced" | "light" | "protein" | "custom";
export type MenuDish = { id: string; name: string; price_vnd: number; image_url: string | null; yield_g: number; portion_limit: number; remaining_portions?: number; step_g: number; min_g: number; max_g: number; nutrition_per100: Macros };
export type Combo = { goal: Exclude<Goal, "custom">; items: Array<{ dish: MenuDish; grams: number }> };
export type TodayMenu = { menu_date: string; dishes: MenuDish[]; combos: Combo[] };
