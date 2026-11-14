import { describe, expect, it } from "vitest";
import {
  createOrderInDb,
  getOrderById,
  transitionOrderStatus,
  checkAndCancelExpiredOrders,
  getOrderEvents,
} from "./orders-db";

describe("Manual Payment & Status Transition Flow", () => {
  it("allows admin to directly transition awaiting_payment to paid (when customer didn't click button)", async () => {
    const { orderId } = await createOrderInDb({
      customerName: "Khách Không Bấm Nút",
      phone: "0901112233",
      deliveryAddress: "123 Lê Lợi, Bến Nghé, Quận 1",
      items: [{ dishId: "ga-nuong-com-gao-lut", grams: 350 }],
    });

    let order = await getOrderById(orderId);
    expect(order?.status).toBe("awaiting_payment");

    // Admin trực tiếp xác nhận đã nhận tiền
    const result = await transitionOrderStatus(orderId, "paid", {
      actor: "admin",
      note: "Admin đối soát app ngân hàng thấy tiền vào",
      expectedCurrentStatuses: ["awaiting_payment", "pending_verification"],
    });

    expect(result.ok).toBe(true);
    expect(result.order?.status).toBe("paid");
    expect(result.order?.paid_at).toBeDefined();

    order = await getOrderById(orderId);
    expect(order?.status).toBe("paid");

    // Kiểm tra order_events đã ghi vết
    const events = await getOrderEvents(orderId);
    const paidEvent = events.find((e) => e.to_status === "paid");
    expect(paidEvent).toBeDefined();
    expect(paidEvent?.actor).toBe("admin");
  });

  it("allows admin to transition pending_verification to paid", async () => {
    const { orderId } = await createOrderInDb({
      customerName: "Khách Đã Bấm Nút",
      phone: "0902223344",
      deliveryAddress: "123 Lê Lợi, Bến Nghé, Quận 1",
      items: [{ dishId: "ga-nuong-com-gao-lut", grams: 350 }],
    });

    // Khách thông báo đã chuyển khoản
    await transitionOrderStatus(orderId, "pending_verification", {
      actor: "customer",
    });

    let order = await getOrderById(orderId);
    expect(order?.status).toBe("pending_verification");

    // Admin xác nhận
    const result = await transitionOrderStatus(orderId, "paid", {
      actor: "admin",
      expectedCurrentStatuses: ["awaiting_payment", "pending_verification"],
    });

    expect(result.ok).toBe(true);
    order = await getOrderById(orderId);
    expect(order?.status).toBe("paid");

    const events = await getOrderEvents(orderId);
    const paidEvent = events.find((e) => e.to_status === "paid");
    expect(paidEvent?.actor).toBe("admin");
  });

  it("enforces anti-collision (optimistic locking) and returns conflict when status already changed", async () => {
    const { orderId } = await createOrderInDb({
      customerName: "Khách Test Chống Trùng",
      phone: "0903334455",
      deliveryAddress: "123 Lê Lợi, Bến Nghé, Quận 1",
      items: [{ dishId: "ga-nuong-com-gao-lut", grams: 350 }],
    });

    // Chuyển sang paid lần 1
    const firstConfirm = await transitionOrderStatus(orderId, "paid", {
      actor: "admin",
      expectedCurrentStatuses: ["awaiting_payment", "pending_verification"],
    });
    expect(firstConfirm.ok).toBe(true);

    // Chuyển sang paid lần 2 (thao tác trùng lặp hoặc tab khác)
    const secondConfirm = await transitionOrderStatus(orderId, "paid", {
      actor: "admin",
      expectedCurrentStatuses: ["awaiting_payment", "pending_verification"],
    });

    expect(secondConfirm.ok).toBe(false);
    expect(secondConfirm.conflict).toBe(true);
  });

  it("cron auto-cancels expired awaiting_payment orders but NEVER cancels pending_verification orders", async () => {
    const pastTime = new Date(Date.now() - 3600_000).toISOString();

    // 1. Đơn awaiting_payment đã quá hạn
    const { orderId: expiredAwaitingId } = await createOrderInDb({
      customerName: "Đơn Chờ Quá Hạn",
      phone: "0904445566",
      deliveryAddress: "123 Lê Lợi, Bến Nghé, Quận 1",
      items: [{ dishId: "ga-nuong-com-gao-lut", grams: 350 }],
    });
    const order1 = await getOrderById(expiredAwaitingId);
    if (order1) {
      order1.expires_at = pastTime;
    }

    // 2. Đơn pending_verification đã quá hạn tạo nhưng khách ĐÃ BẤM CHUYỂN
    const { orderId: pendingId } = await createOrderInDb({
      customerName: "Đơn Đã Báo Chuyển Nhưng Lâu",
      phone: "0905556677",
      deliveryAddress: "123 Lê Lợi, Bến Nghé, Quận 1",
      items: [{ dishId: "ga-nuong-com-gao-lut", grams: 350 }],
    });
    await transitionOrderStatus(pendingId, "pending_verification", {
      actor: "customer",
    });
    const order2 = await getOrderById(pendingId);
    if (order2) {
      order2.expires_at = pastTime;
    }

    // Chạy kiểm tra hết hạn (cron)
    await checkAndCancelExpiredOrders();

    // Kết quả:
    // Đơn awaiting_payment PHẢI bị hủy với cancel_reason = 'expired'
    const updatedOrder1 = await getOrderById(expiredAwaitingId);
    expect(updatedOrder1?.status).toBe("cancelled");
    expect(updatedOrder1?.cancel_reason).toBe("expired");

    // Đơn pending_verification KHÔNG ĐƯỢC PHÉP bị hủy
    const updatedOrder2 = await getOrderById(pendingId);
    expect(updatedOrder2?.status).toBe("pending_verification");
    expect(updatedOrder2?.cancel_reason).toBeNull();
  });

  it("allows admin to restore and confirm expired cancelled order", async () => {
    const { orderId } = await createOrderInDb({
      customerName: "Khách Chuyển Trễ",
      phone: "0906667788",
      deliveryAddress: "123 Lê Lợi, Bến Nghé, Quận 1",
      items: [{ dishId: "ga-nuong-com-gao-lut", grams: 350 }],
    });

    const order = await getOrderById(orderId);
    if (order) {
      order.expires_at = new Date(Date.now() - 3600_000).toISOString();
    }
    await checkAndCancelExpiredOrders();

    const cancelledOrder = await getOrderById(orderId);
    expect(cancelledOrder?.status).toBe("cancelled");
    expect(cancelledOrder?.cancel_reason).toBe("expired");

    // Admin bấm 'Khôi phục và xác nhận đã nhận tiền'
    const restoreResult = await transitionOrderStatus(orderId, "paid", {
      actor: "admin",
      note: "Khôi phục và xác nhận đã nhận tiền",
      expectedCurrentStatuses: ["cancelled"],
    });

    expect(restoreResult.ok).toBe(true);
    expect(restoreResult.order?.status).toBe("paid");
    expect(restoreResult.order?.cancel_reason).toBeNull();

    // Kiểm tra order_events
    const events = await getOrderEvents(orderId);
    const restoreEvent = events.find(
      (e) => e.from_status === "cancelled" && e.to_status === "paid"
    );
    expect(restoreEvent).toBeDefined();
    expect(restoreEvent?.actor).toBe("admin");
  });
});

