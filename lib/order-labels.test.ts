import { describe, expect, it } from "vitest";
import {
  CUSTOMER_ORDER_LABELS,
  getCustomerOrderLabel,
  getOrderStepProgress,
  ORDER_5_STEPS,
} from "./order-labels";
import type { OrderStatus } from "./types";

describe("lib/order-labels", () => {
  it("maps every status to exact specified Vietnamese label", () => {
    expect(CUSTOMER_ORDER_LABELS.awaiting_payment).toBe("Chờ chuyển khoản");
    expect(CUSTOMER_ORDER_LABELS.pending_verification).toBe("Chờ bếp xác nhận thanh toán");
    expect(CUSTOMER_ORDER_LABELS.paid).toBe("Đã nhận đơn, đang chuẩn bị");
    expect(CUSTOMER_ORDER_LABELS.cooking).toBe("Đã nhận đơn, đang chuẩn bị");
    expect(CUSTOMER_ORDER_LABELS.packed).toBe("Đã chuẩn bị xong, chờ giao");
    expect(CUSTOMER_ORDER_LABELS.delivered).toBe("Đã giao");
    expect(CUSTOMER_ORDER_LABELS.cancelled).toBe("Đã hủy");

    const allStatuses: OrderStatus[] = [
      "awaiting_payment",
      "pending_verification",
      "paid",
      "cooking",
      "packed",
      "delivered",
      "cancelled",
    ];

    for (const status of allStatuses) {
      expect(getCustomerOrderLabel(status)).toBe(CUSTOMER_ORDER_LABELS[status]);
    }
  });

  it("calculates 5-step progress correctly", () => {
    expect(ORDER_5_STEPS.length).toBe(5);
    expect(ORDER_5_STEPS.map((s) => s.label)).toEqual([
      "Đặt đơn",
      "Chuyển khoản",
      "Bếp xác nhận",
      "Đang chuẩn bị",
      "Đã giao",
    ]);

    // awaiting_payment
    const awaiting = getOrderStepProgress("awaiting_payment");
    expect(awaiting.currentStep).toBe(2);
    expect(awaiting.completedSteps).toEqual([1]);

    // pending_verification
    const pending = getOrderStepProgress("pending_verification");
    expect(pending.currentStep).toBe(3);
    expect(pending.completedSteps).toEqual([1, 2]);

    // paid stops at 'Đang chuẩn bị' (step 4)
    const paid = getOrderStepProgress("paid");
    expect(paid.currentStep).toBe(4);
    expect(paid.completedSteps).toEqual([1, 2, 3]);
    expect(paid.stepLabel).toBe("Đang chuẩn bị");

    // cooking stops at 'Đang chuẩn bị' (step 4)
    const cooking = getOrderStepProgress("cooking");
    expect(cooking.currentStep).toBe(4);
    expect(cooking.completedSteps).toEqual([1, 2, 3]);
    expect(cooking.stepLabel).toBe("Đang chuẩn bị");

    // packed has completed step 4
    const packed = getOrderStepProgress("packed");
    expect(packed.completedSteps).toContain(4);

    // delivered completes all 5 steps
    const delivered = getOrderStepProgress("delivered");
    expect(delivered.currentStep).toBe(5);
    expect(delivered.completedSteps).toEqual([1, 2, 3, 4, 5]);

    // cancelled
    const cancelled = getOrderStepProgress("cancelled");
    expect(cancelled.isCancelled).toBe(true);
    expect(cancelled.currentStep).toBe(0);
  });
});

