import { describe, it, expect, beforeEach } from "vitest";
import { POST } from "@/app/api/orders/lookup/route";
import { createOrderInDb, getOrdersByPhone, resetFallbackDemoData } from "./orders-db";

describe("Order Tracking & Lookup Suite", () => {
  beforeEach(() => {
    resetFallbackDemoData();
  });

  it("1. getOrdersByPhone retrieves orders matching the customer phone", async () => {
    const testPhone = "0988776655";
    const created = await createOrderInDb({
      customerName: "Nguyễn Văn Test",
      phone: testPhone,
      deliveryAddress: "123 Lê Lợi, Phường Bến Nghé, Quận 1",
      customerEmail: "test@example.com",
      note: "Giao giờ trưa",
      items: [{ dishId: "ga-nuong-com-gao-lut", grams: 350 }],
      publicToken: "test_tracking_token_01",
    });

    const orders = await getOrdersByPhone(testPhone);
    expect(orders.length).toBeGreaterThanOrEqual(1);
    const found = orders.find((o) => o.public_token === created.publicToken);
    expect(found).toBeDefined();
    expect(found?.public_code).toBe(created.publicCode);
  });

  it("2. POST /api/orders/lookup returns masked customer data and valid tracking URLs", async () => {
    const testPhone = "0912349999";
    const created = await createOrderInDb({
      customerName: "Trần Thị Hoàng",
      phone: testPhone,
      deliveryAddress: "456 Nguyễn Huệ, Phường Bến Nghé, Quận 1",
      items: [{ dishId: "ca-hoi-sot-chanh", grams: 300 }],
      publicToken: "test_lookup_token_02",
    });

    // Tra cứu theo số điện thoại
    const reqByPhone = new Request("http://localhost:3000/api/orders/lookup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: testPhone }),
    });

    const resByPhone = await POST(reqByPhone);
    expect(resByPhone.status).toBe(200);
    const dataByPhone = await resByPhone.json();
    expect(dataByPhone.orders.length).toBeGreaterThanOrEqual(1);

    const matchOrder = dataByPhone.orders.find(
      (o: { publicCode: string }) => o.publicCode === created.publicCode
    );
    expect(matchOrder).toBeDefined();
    expect(matchOrder.phone).toContain("****"); // Phải che số điện thoại bảo mật
    expect(matchOrder.trackingUrl).toBe(`/orders/${created.publicToken}`);
    expect(matchOrder.paymentUrl).toBe(`/payment/${created.publicToken}`);

    // Tra cứu theo mã đơn MHLN####
    const reqByCode = new Request("http://localhost:3000/api/orders/lookup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: created.publicCode }),
    });

    const resByCode = await POST(reqByCode);
    expect(resByCode.status).toBe(200);
    const dataByCode = await resByCode.json();
    expect(dataByCode.orders.length).toBe(1);
    expect(dataByCode.orders[0].publicCode).toBe(created.publicCode);
  });

  it("3. POST /api/orders/lookup rejects invalid query (<3 characters)", async () => {
    const req = new Request("http://localhost:3000/api/orders/lookup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: "12" }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("tối thiểu 3 ký tự");
  });
});
