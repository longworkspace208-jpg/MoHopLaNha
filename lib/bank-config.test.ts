import { describe, expect, it } from "vitest";
import { generateVietQrPayload, getVietQrImageUrl } from "./bank-config";

describe("vietqr configuration and generators", () => {
  it("creates valid VietQR image url with params", () => {
    const url = getVietQrImageUrl(75000, "MHLN1234");
    expect(url).toContain("https://img.vietqr.io/image/");
    expect(url).toContain("amount=75000");
    expect(url).toContain("addInfo=MHLN1234");
  });

  it("generates standard EMVCo string with CRC", () => {
    const payload = generateVietQrPayload(90000, "MHLN9999");
    expect(payload.startsWith("000201")).toBe(true); // Format Indicator
    expect(payload).toContain("5303704"); // VND
    expect(payload).toContain("540590000"); // 90000 VND
    expect(payload).toContain("5802VN"); // Vietnam
    expect(payload).toContain("MHLN9999"); // Memo
    expect(payload).toMatch(/6304[0-9A-F]{4}$/); // CRC-16 checksum
  });
});

