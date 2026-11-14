export type BankConfig = {
  bankName: string;
  accountNo: string;
  accountHolder: string;
  paymentWindowMin: number;
};

/**
 * Lấy cấu hình tài khoản ngân hàng từ biến môi trường phía server.
 * Tuyệt đối không ghi giá trị thật vào code và không dùng tiền tố NEXT_PUBLIC_.
 */
export function getBankConfig(): BankConfig {
  const windowMin = parseInt(process.env.PAYMENT_WINDOW_MIN || "60", 10);

  return {
    bankName: process.env.BANK_NAME || "Ngân hàng thụ hưởng",
    accountNo: process.env.BANK_ACCOUNT_NO || "",
    accountHolder: process.env.BANK_ACCOUNT_HOLDER || "",
    paymentWindowMin: Number.isFinite(windowMin) && windowMin > 0 ? windowMin : 60,
  };
}

export const BANK_CONFIG = {
  get bankName() {
    return getBankConfig().bankName;
  },
  get accountNo() {
    return getBankConfig().accountNo;
  },
  get accountHolder() {
    return getBankConfig().accountHolder;
  },
  get paymentWindowMin() {
    return getBankConfig().paymentWindowMin;
  },
};
