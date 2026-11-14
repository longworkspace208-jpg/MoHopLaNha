import { describe, expect, it } from "vitest";
import { getBankConfig } from "./bank-config";

describe("Bank Configuration", () => {
  it("reads bank configuration from environment variables", () => {
    const config = getBankConfig();
    expect(config).toHaveProperty("bankName");
    expect(config).toHaveProperty("accountNo");
    expect(config).toHaveProperty("accountHolder");
    expect(config.paymentWindowMin).toBeGreaterThanOrEqual(5);
  });

  it("defaults paymentWindowMin to 60 if missing", () => {
    const original = process.env.PAYMENT_WINDOW_MIN;
    delete process.env.PAYMENT_WINDOW_MIN;
    const config = getBankConfig();
    expect(config.paymentWindowMin).toBe(60);
    process.env.PAYMENT_WINDOW_MIN = original;
  });
});
