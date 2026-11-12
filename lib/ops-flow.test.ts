import { describe, expect, it } from "vitest";
import {
  createOrderInDb,
  getAllCookingBatches,
  getAllOrders,
  getDishIngredientsSnapshot,
  getOrderById,
  getPortionByQrCode,
  getPortionsByOrder,
  OutOfStockError,
  resetFallbackDemoData,
  saveCookingBatch,
  savePortionSnapshot,
  updateOrderStatusWithTimestamp,
} from "./orders-db";

describe("Ops Workflow Lifecycle (paid -> cooking -> packed -> delivered)", () => {
  it("executes full order lifecycle from awaiting_payment to delivered with cooking batch and immutable nutrition snapshot", async () => {
    const { orderId, publicCode } = await createOrderInDb({
      customerName: "Nguyễn Ops Test",
      phone: "0909998887",
      customerEmail: "ops@example.com",
      deliveryAddress: "100 Nguyễn Huệ, Bến Nghé, Quận 1",
      note: "Giao trưa",
      items: [{ dishId: "ca-hoi-sot-chanh", grams: 300 }],
    });

    const created = await getOrderById(orderId);
    expect(created).not.toBeNull();
    expect(created?.status).toBe("awaiting_payment");

    // 1. awaiting_payment -> pending_verification
    const rPending = await updateOrderStatusWithTimestamp(
      orderId,
      "pending_verification"
    );
    expect(rPending.ok).toBe(true);
    expect(rPending.order?.status).toBe("pending_verification");

    // 2. pending_verification -> paid
    const rPaid = await updateOrderStatusWithTimestamp(orderId, "paid");
    expect(rPaid.ok).toBe(true);
    expect(rPaid.order?.status).toBe("paid");
    expect(rPaid.order?.paid_at).toBeTruthy();

    // 3. paid -> cooking
    const rCooking = await updateOrderStatusWithTimestamp(orderId, "cooking");
    expect(rCooking.ok).toBe(true);
    expect(rCooking.order?.status).toBe("cooking");
    expect(rCooking.order?.cooking_at).toBeTruthy();

    // 4. Create cooking batch
    const lotCode = `LOT-${publicCode}-01`;
    const batch = await saveCookingBatch({
      dishId: "ca-hoi-sot-chanh",
      dishName: "Cá hồi sốt chanh",
      lotCode,
      supplierNote: "Cá hồi Na Uy nhập khẩu",
      cookedYieldG: 1500,
      cookedAt: "2026-11-12T08:00:00.000Z",
    });
    expect(batch.id).toBeTruthy();
    expect(batch.lotCode).toBe(lotCode);
    expect(getAllCookingBatches().some((b) => b.id === batch.id)).toBe(true);

    // 5. Pack -> savePortionSnapshot + transition to packed
    const item = created!.items[0];
    const ingredients = await getDishIngredientsSnapshot(item.dishId);
    expect(ingredients.length).toBeGreaterThan(0);

    const allergens = Array.from(
      new Set(ingredients.flatMap((ing) => ing.allergens))
    );
    expect(allergens).toContain("Cá");

    const actualGrams = 315;
    const scale = actualGrams / item.grams;
    const qrCode = `${publicCode}-CA-001`;
    const packedAt = "2026-11-12T10:30:00.000Z";

    const saved = await savePortionSnapshot({
      orderId,
      orderItemId: 1,
      qrCode,
      dishName: item.name,
      cookedAt: "2026-11-12",
      cookedBatchId: batch.id,
      actualGrams,
      kcal: Number((item.nutrition.kcal * scale).toFixed(2)),
      proteinG: Number((item.nutrition.protein * scale).toFixed(2)),
      carbsG: Number((item.nutrition.carbs * scale).toFixed(2)),
      fatG: Number((item.nutrition.fat * scale).toFixed(2)),
      ingredients,
      allergens,
      sourceNote: batch.supplierNote,
      lotCode: batch.lotCode,
      packedAt,
    });

    expect(saved.id).toBeTruthy();

    const fetchedByQr = await getPortionByQrCode(qrCode);
    expect(fetchedByQr).not.toBeNull();
    expect(fetchedByQr).toEqual(saved);
    expect(fetchedByQr?.dishName).toBe(item.name);
    expect(fetchedByQr?.cookedAt).toBe("2026-11-12");
    expect(fetchedByQr?.actualGrams).toBe(315);
    expect(fetchedByQr?.kcal).toBeCloseTo(item.nutrition.kcal * scale, 2);
    expect(fetchedByQr?.proteinG).toBeCloseTo(item.nutrition.protein * scale, 2);
    expect(fetchedByQr?.carbsG).toBeCloseTo(item.nutrition.carbs * scale, 2);
    expect(fetchedByQr?.fatG).toBeCloseTo(item.nutrition.fat * scale, 2);
    expect(fetchedByQr?.ingredients).toEqual(ingredients);
    expect(fetchedByQr?.allergens).toContain("Cá");
    expect(fetchedByQr?.sourceNote).toBe("Cá hồi Na Uy nhập khẩu");
    expect(fetchedByQr?.lotCode).toBe(lotCode);
    expect(fetchedByQr?.packedAt).toBe(packedAt);

    const byOrder = await getPortionsByOrder(orderId);
    expect(byOrder).toHaveLength(1);
    expect(byOrder[0].qrCode).toBe(qrCode);

    const rPacked = await updateOrderStatusWithTimestamp(orderId, "packed");
    expect(rPacked.ok).toBe(true);
    expect(rPacked.order?.status).toBe("packed");
    expect(rPacked.order?.packed_at).toBeTruthy();

    // 6. packed -> delivered
    const rDelivered = await updateOrderStatusWithTimestamp(orderId, "delivered");
    expect(rDelivered.ok).toBe(true);
    expect(rDelivered.order?.status).toBe("delivered");
    expect(rDelivered.order?.delivered_at).toBeTruthy();

    const finalOrder = await getOrderById(orderId);
    expect(finalOrder?.status).toBe("delivered");
    expect(finalOrder?.paid_at).toBeTruthy();
    expect(finalOrder?.cooking_at).toBeTruthy();
    expect(finalOrder?.packed_at).toBeTruthy();
    expect(finalOrder?.delivered_at).toBeTruthy();
  });

  it("rejects invalid status transitions", async () => {
    const { orderId } = await createOrderInDb({
      customerName: "Invalid Transition Test",
      phone: "0911223344",
      deliveryAddress: "15 Đồng Khởi, Bến Nghé, Quận 1",
      items: [{ dishId: "ga-nuong-com-gao-lut", grams: 350 }],
    });

    // awaiting_payment -> paid directly is invalid
    const directPaid = await updateOrderStatusWithTimestamp(orderId, "paid");
    expect(directPaid.ok).toBe(false);
    expect(directPaid.error).toBeTruthy();

    // Walk up to packed
    expect(
      (await updateOrderStatusWithTimestamp(orderId, "pending_verification")).ok
    ).toBe(true);
    expect((await updateOrderStatusWithTimestamp(orderId, "paid")).ok).toBe(
      true
    );
    expect((await updateOrderStatusWithTimestamp(orderId, "cooking")).ok).toBe(
      true
    );
    expect((await updateOrderStatusWithTimestamp(orderId, "packed")).ok).toBe(
      true
    );

    // packed -> cooking backwards is invalid
    const backwards = await updateOrderStatusWithTimestamp(orderId, "cooking");
    expect(backwards.ok).toBe(false);
    expect(backwards.error).toBeTruthy();
  });

  it("returns null for unknown qr_code and omits all customer PII from snapshot", async () => {
    const missing = await getPortionByQrCode("INVALID-QR-CODE");
    expect(missing).toBeNull();

    const customerName = "Khách Bí Mật";
    const phone = "0901112223";
    const customerEmail = "secret@example.com";
    const deliveryAddress = "99 Lê Lợi, Bến Nghé, Quận 1";

    const { orderId, publicCode } = await createOrderInDb({
      customerName,
      phone,
      customerEmail,
      deliveryAddress,
      items: [{ dishId: "ca-hoi-sot-chanh", grams: 300 }],
    });

    const created = await getOrderById(orderId);
    const item = created!.items[0];
    const ingredients = await getDishIngredientsSnapshot(item.dishId);
    const allergens = Array.from(
      new Set(ingredients.flatMap((ing) => ing.allergens))
    );
    const qrCode = `${publicCode}-PII-CHECK`;

    await savePortionSnapshot({
      orderId,
      orderItemId: 1,
      qrCode,
      dishName: item.name,
      cookedAt: "2026-11-12",
      actualGrams: 300,
      kcal: item.nutrition.kcal,
      proteinG: item.nutrition.protein,
      carbsG: item.nutrition.carbs,
      fatG: item.nutrition.fat,
      ingredients,
      allergens,
      sourceNote: "Nông trại VietGAP",
      lotCode: "LOT-PRIVACY-01",
      packedAt: "2026-11-12T11:00:00.000Z",
    });

    const snapshot = await getPortionByQrCode(qrCode);
    expect(snapshot).not.toBeNull();
    expect(snapshot).toMatchObject({
      qrCode,
      dishName: item.name,
      cookedAt: "2026-11-12",
      actualGrams: 300,
      kcal: item.nutrition.kcal,
      proteinG: item.nutrition.protein,
      carbsG: item.nutrition.carbs,
      fatG: item.nutrition.fat,
      ingredients,
      allergens,
      sourceNote: "Nông trại VietGAP",
      lotCode: "LOT-PRIVACY-01",
      packedAt: "2026-11-12T11:00:00.000Z",
    });

    const serialized = JSON.stringify(snapshot);
    expect(serialized).not.toContain(customerName);
    expect(serialized).not.toContain(phone);
    expect(serialized).not.toContain(customerEmail);
    expect(serialized).not.toContain(deliveryAddress);
  });

  it("seeds one sample order per status and blocks sold-out dish orders", async () => {
    resetFallbackDemoData();
    const orders = await getAllOrders();
    const statuses = new Set(orders.map((o) => o.status));

    expect(statuses).toEqual(
      new Set([
        "awaiting_payment",
        "pending_verification",
        "paid",
        "cooking",
        "packed",
        "delivered",
        "cancelled",
      ])
    );

    const packedSnap = await getPortionByQrCode("MHLN1005-GA-001");
    expect(packedSnap).not.toBeNull();
    expect(packedSnap?.lotCode).toBe("LOT-DEMO-GA-01");

    await expect(
      createOrderInDb({
        customerName: "Sold Out Test",
        phone: "0901234567",
        deliveryAddress: "12 Nguyễn Huệ, Quận 1",
        items: [{ dishId: "bo-ap-chao-mang-tay", grams: 350 }],
      })
    ).rejects.toThrow(OutOfStockError);
  });
});
