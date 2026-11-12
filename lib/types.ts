import type { Macros } from "./nutrition";

export type Nutrition = Macros & { fiber: number };

export type Dish = {
  id: string;
  name: string;
  price: number;
  image: string;
  description: string;
  nutrition: Nutrition;
};

export type CartLine = {
  dishId: string;
  quantity: number;
};

export type OrderStatus =
  | "awaiting_payment"
  | "pending_verification"
  | "paid"
  | "cooking"
  | "packed"
  | "delivered"
  | "cancelled";

export type OrderItemSnapshot = {
  id?: string | number;
  dishId: string;
  name: string;
  grams: number;
  unitPrice: number;
  nutrition: Macros;
};

export type OrderRecord = {
  id: string;
  public_code: string;
  customer_name: string;
  phone: string;
  customer_email?: string | null;
  delivery_address: string;
  note?: string | null;
  status: OrderStatus;
  subtotal_vnd: number;
  shipping_fee_vnd: number;
  total_vnd: number;
  nutrition_snapshot: Macros;
  items: OrderItemSnapshot[];
  created_at: string;
  paid_at?: string | null;
  cooking_at?: string | null;
  packed_at?: string | null;
  delivered_at?: string | null;
};


export type CookingBatch = {
  id: string;
  dishId: string;
  dishName: string;
  lotCode: string;
  supplierNote?: string | null;
  cookedYieldG: number;
  cookedAt: string;
};

export type PortionSnapshot = {
  id: string;
  orderId: string;
  orderItemId: number;
  qrCode: string;         // e.g. MHLN4358-GA-001
  dishName: string;
  cookedAt: string;       // date YYYY-MM-DD
  cookedBatchId?: string | null;
  actualGrams: number;
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  ingredients: Array<{ name: string; rawG: number; allergens: string[] }>;
  allergens: string[];
  sourceNote?: string | null;
  lotCode?: string | null;
  packedAt: string;
};

export type NutritionSnapshot = PortionSnapshot;
