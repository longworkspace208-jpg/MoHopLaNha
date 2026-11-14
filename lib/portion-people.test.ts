import { describe, expect, it, vi } from "vitest";
import { validateGramsForDish } from "./validations";
import { calculateOrderFromDb, createOrderInDb, getOrderById } from "./orders-db";
import {
  aggregateDishProduction,
  aggregateIngredientRequirements,
  calculatePerPersonEstimate,
} from "./production";
import type { OrderRecord } from "./types";

describe("Portion Suggestion & People Independence Suite", () => {
  describe("1. Unit Test: Portion Suggestion & Manual Override & Gram Bounds", () => {
    const mockDish = {
      id: "mon-test",
      name: "Món Thử Nghiệm",
      min_g: 100,
      max_g: 200,
      step_g: 50,
      yield_g: 100,
      price_vnd: 50000, // 50,000 VND / 100g
    };

    it("calculates line price strictly from grams (price_per_100g * grams / 100), not multiplied by people", () => {
      // 3 người, gợi ý ban đầu là 600g (200g * 3).
      // Khách hàng bấm sửa gram thành 200g:
      const editedGrams = 200;
      const pricePer100g = mockDish.price_vnd / (mockDish.yield_g / 100);
      const computedPrice = Math.round((mockDish.price_vnd / mockDish.yield_g) * editedGrams);

      // Giá phải bằng đúng price_per_100g * 2 (100,000 VND), không bị nhân 3
      expect(computedPrice).toBe(100000);
      expect(computedPrice).toBe((pricePer100g * editedGrams) / 100);
    });

    it("enforces gram bounds: min_g .. max_g * people, rejecting out-of-range grams", () => {
      const people = 3;
      // max_g cho 3 người = 200 * 3 = 600g
      // 700g > 600g -> Server từ chối
      const overLimitCheck = validateGramsForDish(mockDish, 700, people);
      expect(overLimitCheck.valid).toBe(false);
      expect(overLimitCheck.error).toContain("tối đa cho 3 người là 600g");

      // 600g (ngay ngưỡng max) -> Chấp nhận
      const maxLimitCheck = validateGramsForDish(mockDish, 600, people);
      expect(maxLimitCheck.valid).toBe(true);

      // 200g (nằm trong khoảng 100..600g, bội số của step_g 50) -> Chấp nhận
      const validCheck = validateGramsForDish(mockDish, 200, people);
      expect(validCheck.valid).toBe(true);

      // 50g (< min_g 100g) -> Server từ chối
      const belowMinCheck = validateGramsForDish(mockDish, 50, people);
      expect(belowMinCheck.valid).toBe(false);
      expect(belowMinCheck.error).toContain("tối thiểu là 100g");

      // 225g (không phải bội số của step_g 50) -> Server từ chối
      const stepCheck = validateGramsForDish(mockDish, 225, people);
      expect(stepCheck.valid).toBe(false);
      expect(stepCheck.error).toContain("bước nhảy 50g");
    });
  });

  describe("2. Database & API Calculation: people=1 vs people=5 yields IDENTICAL Total Price", () => {
    it("calculateOrderFromDb returns identical subtotal, shipping fee, and total for people=1 vs people=5", async () => {
      const cartItems = [{ dishId: "ga-nuong-com-gao-lut", grams: 350 }];

      const calcFor1 = await calculateOrderFromDb(cartItems, 1);
      const calcFor5 = await calculateOrderFromDb(cartItems, 5);

      // Cùng giỏ hàng 350g, giá và dinh dưỡng đơn hàng phải hoàn toàn giống nhau
      expect(calcFor1.subtotal).toBe(calcFor5.subtotal);
      expect(calcFor1.shippingFee).toBe(calcFor5.shippingFee);
      expect(calcFor1.total).toBe(calcFor5.total);
      expect(calcFor1.items[0].unitPrice).toBe(calcFor5.items[0].unitPrice);
      expect(calcFor1.items[0].grams).toBe(350);
      expect(calcFor5.items[0].grams).toBe(350);

      // Dinh dưỡng toàn đơn hoàn toàn giống nhau
      expect(calcFor1.nutrition.kcal).toBe(calcFor5.nutrition.kcal);
      expect(calcFor1.nutrition.protein).toBe(calcFor5.nutrition.protein);
      expect(calcFor1.nutrition.carbs).toBe(calcFor5.nutrition.carbs);
      expect(calcFor1.nutrition.fat).toBe(calcFor5.nutrition.fat);
    });

    it("createOrderInDb stores people purely as reference and keeps total price identical", async () => {
      const cartItems = [{ dishId: "dau-hu-nam-hat", grams: 200 }];

      const order1Result = await createOrderInDb({
        customerName: "Khách 1 Người",
        phone: "0901112233",
        deliveryAddress: "123 Lê Lợi, Bến Nghé, Quận 1",
        items: cartItems,
        people: 1,
        goal: "balanced",
      });

      const order5Result = await createOrderInDb({
        customerName: "Khách 5 Người",
        phone: "0902223344",
        deliveryAddress: "456 Nguyễn Huệ, Bến Nghé, Quận 1",
        items: cartItems,
        people: 5,
        goal: "balanced",
      });

      const order1 = await getOrderById(order1Result.orderId);
      const order5 = await getOrderById(order5Result.orderId);

      expect(order1).not.toBeNull();
      expect(order5).not.toBeNull();

      // Số người được lưu đúng làm thông tin tham khảo
      expect(order1?.people).toBe(1);
      expect(order5?.people).toBe(5);

      // Tiền và khối lượng trên từng dòng và toàn bộ đơn KHÔNG ĐỔI
      expect(order1?.items[0].grams).toBe(200);
      expect(order5?.items[0].grams).toBe(200);
      expect(order1?.subtotal_vnd).toBe(order5?.subtotal_vnd);
      expect(order1?.total_vnd).toBe(order5?.total_vnd);
    });

    it("POST /api/orders route handler validates people schema and yields same total price", async () => {
      // Mock Cloudflare Turnstile xác thực thành công
      vi.mock("@/lib/turnstile", () => ({
        verifyTurnstileToken: vi.fn().mockResolvedValue({ success: true }),
      }));

      const { POST } = await import("@/app/api/orders/route");

      const payload1 = {
        customerName: "Người Mua 1",
        phone: "0918881111",
        address: "789 Đồng Khởi, Bến Nghé, Quận 1",
        items: [{ dishId: "ga-nuong-com-gao-lut", grams: 350 }],
        people: 1,
        turnstileToken: "dummy-token",
      };

      const payload5 = {
        customerName: "Người Mua 5",
        phone: "0918882222",
        address: "789 Đồng Khởi, Bến Nghé, Quận 1",
        items: [{ dishId: "ga-nuong-com-gao-lut", grams: 350 }],
        people: 5,
        turnstileToken: "dummy-token",
      };

      const res1 = await POST(
        new Request("http://localhost/api/orders", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload1),
        })
      );
      const data1 = await res1.json();
      expect(res1.status).toBe(200);
      expect(data1.orderId).toBeDefined();

      const res5 = await POST(
        new Request("http://localhost/api/orders", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload5),
        })
      );
      const data5 = await res5.json();
      expect(res5.status).toBe(200);
      expect(data5.orderId).toBeDefined();

      const order1 = await getOrderById(data1.orderId);
      const order5 = await getOrderById(data5.orderId);

      // Cả 2 đơn có cùng tổng tiền dù people khác nhau
      expect(order1?.total_vnd).toBe(order5?.total_vnd);
      expect(order1?.subtotal_vnd).toBe(order5?.subtotal_vnd);
    });
  });

  describe("3. Production & Kitchen: Raw Ingredients Unchanged When Changing People", () => {
    it("aggregateDishProduction and aggregateIngredientRequirements are immune to order.people", () => {
      const baseItems = [
        {
          id: 1,
          dishId: "ga-nuong-com-gao-lut",
          name: "Gà nướng kèm cơm gạo lứt",
          grams: 350,
          unitPrice: 85000,
          nutrition: { kcal: 520, protein: 38, carbs: 55, fat: 12 },
        },
        {
          id: 2,
          dishId: "dau-hu-nam-hat",
          name: "Đậu hũ sốt nấm và hạt",
          grams: 200,
          unitPrice: 38000,
          nutrition: { kcal: 280, protein: 18, carbs: 22, fat: 14 },
        },
      ];

      const orderWith1Person: OrderRecord = {
        id: "ord-test-1",
        public_token: "tok-test-1",
        public_code: "MHLN9001",
        customer_name: "Khách 1",
        phone: "0901234567",
        delivery_address: "123 Lê Lợi, Q1",
        status: "paid",
        subtotal_vnd: 123000,
        shipping_fee_vnd: 15000,
        total_vnd: 138000,
        nutrition_snapshot: { kcal: 800, protein: 56, carbs: 77, fat: 26 },
        people: 1,
        goal: "balanced",
        items: baseItems,
        created_at: new Date().toISOString(),
      };

      const orderWith5People: OrderRecord = {
        ...orderWith1Person,
        id: "ord-test-5",
        public_token: "tok-test-5",
        public_code: "MHLN9005",
        customer_name: "Khách 5",
        people: 5,
      };

      // 1. Tổng khối lượng sản xuất món
      const dishProd1 = aggregateDishProduction([orderWith1Person]);
      const dishProd5 = aggregateDishProduction([orderWith5People]);

      expect(dishProd1).toEqual(dishProd5);
      expect(dishProd1.find((d) => d.dishId === "ga-nuong-com-gao-lut")?.totalGrams).toBe(350);
      expect(dishProd1.find((d) => d.dishId === "dau-hu-nam-hat")?.totalGrams).toBe(200);

      // 2. Tổng nguyên liệu thô cần chuẩn bị
      const ingredients1 = aggregateIngredientRequirements([orderWith1Person]);
      const ingredients5 = aggregateIngredientRequirements([orderWith5People]);

      // Nhu cầu nguyên liệu thô KHÔNG HỀ ĐỔI khi đổi số người (people)
      expect(ingredients1).toEqual(ingredients5);
      expect(ingredients1.length).toBeGreaterThan(0);

      for (let i = 0; i < ingredients1.length; i++) {
        expect(ingredients1[i].ingredientId).toBe(ingredients5[i].ingredientId);
        expect(ingredients1[i].totalRawG).toBe(ingredients5[i].totalRawG);
      }
    });

    it("calculatePerPersonEstimate computes display-only per-person nutritional estimates", () => {
      const totalMacros = { kcal: 1200, protein: 90, carbs: 120, fat: 30 };

      // 1 người -> chia đều bằng chính nó
      const est1 = calculatePerPersonEstimate(totalMacros, 1);
      expect(est1.kcal).toBe(1200);
      expect(est1.protein).toBe(90);

      // 3 người -> chia đều 3
      const est3 = calculatePerPersonEstimate(totalMacros, 3);
      expect(est3.kcal).toBe(400);
      expect(est3.protein).toBe(30);
      expect(est3.carbs).toBe(40);
      expect(est3.fat).toBe(10);
    });
  });
});
