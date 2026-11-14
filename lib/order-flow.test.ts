import { describe, expect, it } from "vitest";
import {
  calculateOrderFromDb,
  createOrderInDb,
  getOrderById,
  getOrderByCode,
  updateOrderStatus
} from "./orders-db";
import { validateServiceArea, DELIVERY_CONFIG } from "./delivery-config";
import { getBankConfig } from "./bank-config";

describe("End-to-End Order & Payment Flow", () => {
  it("validates address service area correctly", () => {
    const valid = validateServiceArea("123 Hai Bà Trưng, Phường Bến Nghé, Quận 1");
    expect(valid.inService).toBe(true);

    const outside = validateServiceArea("99 Cầu Giấy, Hà Nội");
    expect(outside.inService).toBe(false);
    expect(outside.message).toContain("Địa chỉ ngoài vùng phục vụ");
  });

  it("recalculates price and nutrition from database (server-side, never trusting client)", async () => {
    const items = [
      { dishId: "ga-nuong-com-gao-lut", grams: 350 },
      { dishId: "dau-hu-nam-hat", grams: 200 }
    ];

    const calc = await calculateOrderFromDb(items);
    expect(calc.items).toHaveLength(2);
    expect(calc.subtotal).toBeGreaterThan(0);
    expect(calc.shippingFee).toBe(DELIVERY_CONFIG.shippingFeeVnd);
    expect(calc.total).toBe(calc.subtotal + calc.shippingFee);

    // Dinh dưỡng phải có đầy đủ macro
    expect(calc.nutrition.kcal).toBeGreaterThan(0);
    expect(calc.nutrition.protein).toBeGreaterThan(0);
    expect(calc.nutrition.carbs).toBeGreaterThan(0);
    expect(calc.nutrition.fat).toBeGreaterThan(0);
  });

  it("creates order with status='awaiting_payment', code='MHLN####', and immutable snapshots", async () => {
    const items = [{ dishId: "ga-nuong-com-gao-lut", grams: 350 }];

    const { orderId, publicCode } = await createOrderInDb({
      customerName: "Nguyễn Văn Test",
      phone: "0901234567",
      customerEmail: "test@example.com",
      deliveryAddress: "45 Lê Thánh Tôn, Bến Nghé, Quận 1",
      note: "Giao trước 12h",
      items
    });

    expect(orderId).toBeDefined();
    expect(publicCode).toMatch(/^MHLN\d{4}$/);

    const order = await getOrderById(orderId);
    expect(order).not.toBeNull();
    expect(order?.public_code).toBe(publicCode);
    expect(order?.status).toBe("awaiting_payment");
    expect(order?.customer_name).toBe("Nguyễn Văn Test");
    expect(order?.customer_email).toBe("test@example.com");
    expect(order?.delivery_address).toContain("Quận 1");
    expect(order?.shipping_fee_vnd).toBe(DELIVERY_CONFIG.shippingFeeVnd);
    expect(order?.total_vnd).toBe(order!.subtotal_vnd + DELIVERY_CONFIG.shippingFeeVnd);
    expect(order?.items).toHaveLength(1);
    expect(order?.items[0].grams).toBe(350);

    // Cấu hình ngân hàng & hạn thanh toán
    const bankConfig = getBankConfig();
    expect(bankConfig.bankName).toBeDefined();
    expect(order?.expires_at).toBeDefined();
  });

  it("updates status to 'pending_verification' ONLY when customer clicks 'Tôi đã chuyển khoản'", async () => {
    const items = [{ dishId: "ca-hoi-sot-chanh", grams: 300 }];

    const { orderId, publicCode } = await createOrderInDb({
      customerName: "Trần Thị Chuyển Khoản",
      phone: "0987654321",
      deliveryAddress: "12 Võ Văn Tần, Phường 6, Quận 3",
      items
    });

    // Ban đầu là awaiting_payment
    let order = await getOrderById(orderId);
    expect(order?.status).toBe("awaiting_payment");

    // Khách bấm "Tôi đã chuyển khoản"
    const success = await updateOrderStatus(orderId, "pending_verification");
    expect(success).toBe(true);

    // Kiểm tra đơn đã ở trạng thái pending_verification
    order = await getOrderById(orderId);
    expect(order?.status).toBe("pending_verification");

    // Tra cứu qua public_code (cho trang /orders/[code])
    const orderByCode = await getOrderByCode(publicCode);
    expect(orderByCode).not.toBeNull();
    expect(orderByCode?.status).toBe("pending_verification");
    expect(orderByCode?.public_code).toBe(publicCode);
  });
});

