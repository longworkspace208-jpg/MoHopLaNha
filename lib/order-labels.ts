import type { OrderStatus } from "./types";

/**
 * Ánh xạ trạng thái đơn hàng sang nhãn hiển thị cho khách hàng (Customer-facing labels).
 * Theo đúng đặc tả hệ thống:
 * - awaiting_payment: 'Chờ chuyển khoản'
 * - pending_verification: 'Chờ bếp xác nhận thanh toán'
 * - paid và cooking: 'Đã nhận đơn, đang chuẩn bị'
 * - packed: 'Đã chuẩn bị xong, chờ giao'
 * - delivered: 'Đã giao'
 * - cancelled: 'Đã hủy'
 */
export const CUSTOMER_ORDER_LABELS: Record<OrderStatus, string> = {
  awaiting_payment: "Chờ chuyển khoản",
  pending_verification: "Chờ bếp xác nhận thanh toán",
  paid: "Đã nhận đơn, đang chuẩn bị",
  cooking: "Đã nhận đơn, đang chuẩn bị",
  packed: "Đã chuẩn bị xong, chờ giao",
  delivered: "Đã giao",
  cancelled: "Đã hủy",
};

export function getCustomerOrderLabel(status: OrderStatus): string {
  return CUSTOMER_ORDER_LABELS[status] ?? "Đang xử lý";
}

export type ProgressStepId = 1 | 2 | 3 | 4 | 5;

export interface ProgressStep {
  step: ProgressStepId;
  label: string;
  description: string;
}

export const ORDER_5_STEPS: ProgressStep[] = [
  { step: 1, label: "Đặt đơn", description: "Đã tạo đơn thành công" },
  { step: 2, label: "Chuyển khoản", description: "Khách chuyển khoản ngân hàng" },
  { step: 3, label: "Bếp xác nhận", description: "Bếp đối soát và khớp giao dịch" },
  { step: 4, label: "Đang chuẩn bị", description: "Bếp chế biến & cân định lượng" },
  { step: 5, label: "Đã giao", description: "Đơn cơm đã giao tới tay bạn" },
];

/**
 * Tính toán bước tiến trình hiện tại trên thang 1..5:
 * - awaiting_payment: Đã xong bước 1, đang ở bước 2 (Chờ chuyển khoản)
 * - pending_verification: Đã xong bước 2, đang ở bước 3 (Chờ bếp xác nhận)
 * - paid, cooking: Đang ở bước 4 (Dừng ở 'Đang chuẩn bị')
 * - packed: Đã chuẩn bị xong bước 4, chuẩn bị giao sang bước 5
 * - delivered: Hoàn tất trọn vẹn cả 5 bước
 * - cancelled: 0 (Đơn đã hủy)
 */
export function getOrderStepProgress(status: OrderStatus): {
  currentStep: number;
  completedSteps: number[];
  isCancelled: boolean;
  stepLabel: string;
} {
  if (status === "cancelled") {
    return {
      currentStep: 0,
      completedSteps: [],
      isCancelled: true,
      stepLabel: "Đã hủy",
    };
  }

  switch (status) {
    case "awaiting_payment":
      return {
        currentStep: 2,
        completedSteps: [1],
        isCancelled: false,
        stepLabel: "Chờ chuyển khoản",
      };
    case "pending_verification":
      return {
        currentStep: 3,
        completedSteps: [1, 2],
        isCancelled: false,
        stepLabel: "Chờ bếp xác nhận",
      };
    case "paid":
    case "cooking":
      return {
        currentStep: 4,
        completedSteps: [1, 2, 3],
        isCancelled: false,
        stepLabel: "Đang chuẩn bị",
      };
    case "packed":
      return {
        currentStep: 4,
        completedSteps: [1, 2, 3, 4],
        isCancelled: false,
        stepLabel: "Đã chuẩn bị xong, chờ giao",
      };
    case "delivered":
      return {
        currentStep: 5,
        completedSteps: [1, 2, 3, 4, 5],
        isCancelled: false,
        stepLabel: "Đã giao",
      };
    default:
      return {
        currentStep: 1,
        completedSteps: [1],
        isCancelled: false,
        stepLabel: "Đang xử lý",
      };
  }
}

