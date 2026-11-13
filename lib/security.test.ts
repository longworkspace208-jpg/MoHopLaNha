import { describe, expect, it } from "vitest";
import { createOrderInDb, getOrderByPublicToken } from "./orders-db";
import { orderCreationSchema, usdaSearchQuerySchema } from "./validations";
import {
  signSessionToken,
  verifySessionToken,
  verifyAdminPasscode,
} from "./admin-auth";

describe("Security Audits & Hardening Suite", () => {
  describe("1. Unguessable Order Public Token", () => {
    it("generates nanoid(21) public_token and blocks lookups with MHLN code", async () => {
      const { orderId, publicCode, publicToken } = await createOrderInDb({
        customerName: "Khách Bảo Mật",
        phone: "0901234567",
        deliveryAddress: "123 Lê Lợi, Phường Bến Nghé, Quận 1",
        items: [{ dishId: "ga-nuong-com-gao-lut", grams: 350 }],
      });

      expect(publicToken).toBeDefined();
      expect(publicToken).toHaveLength(21);
      expect(publicCode).toMatch(/^MHLN\d{4}$/);

      // Tra cứu đúng bằng public_token -> Thành công
      const order = await getOrderByPublicToken(publicToken);
      expect(order).not.toBeNull();
      expect(order?.id).toBe(orderId);
      expect(order?.public_token).toBe(publicToken);

      // Kẻ tấn công cố tình đoán bằng mã MHLN#### qua route token -> BỊ CHẶN (null)
      const guessedByCode = await getOrderByPublicToken(publicCode);
      expect(guessedByCode).toBeNull();

      // Đoán bằng ID đơn cũ -> BỊ CHẶN (null)
      const guessedById = await getOrderByPublicToken(orderId);
      expect(guessedById).toBeNull();

      // Đoán token ngẫu nhiên -> BỊ CHẶN (null)
      const fakeToken = await getOrderByPublicToken("000000000000000000000");
      expect(fakeToken).toBeNull();
    });
  });

  describe("2. Input Validation with Zod", () => {
    it("validates Vietnamese phone numbers correctly", () => {
      // Số điện thoại Việt Nam hợp lệ
      expect(
        orderCreationSchema.safeParse({
          customerName: "Nguyễn Văn A",
          phone: "0912345678",
          address: "123 Lê Lợi, Quận 1",
          items: [{ dishId: "ca-hoi-sot-chanh", grams: 300 }],
        }).success
      ).toBe(true);

      expect(
        orderCreationSchema.safeParse({
          customerName: "Trần Thị B",
          phone: "0387654321",
          address: "45 Hai Bà Trưng, Quận 1",
          items: [{ dishId: "ca-hoi-sot-chanh", grams: 300 }],
        }).success
      ).toBe(true);

      // Số điện thoại không hợp lệ (sai tiền tố, thiếu số, chứa chữ)
      expect(
        orderCreationSchema.safeParse({
          customerName: "Nguyễn Văn A",
          phone: "123456",
          address: "123 Lê Lợi, Quận 1",
          items: [{ dishId: "ca-hoi-sot-chanh", grams: 300 }],
        }).success
      ).toBe(false);

      expect(
        orderCreationSchema.safeParse({
          customerName: "Nguyễn Văn A",
          phone: "01999999999", // 11 số cũ
          address: "123 Lê Lợi, Quận 1",
          items: [{ dishId: "ca-hoi-sot-chanh", grams: 300 }],
        }).success
      ).toBe(false);
    });

    it("rejects orders exceeding 20 items or zero items", () => {
      // 0 món -> Bị chặn
      const empty = orderCreationSchema.safeParse({
        customerName: "Nguyễn Văn A",
        phone: "0912345678",
        address: "123 Lê Lợi, Quận 1",
        items: [],
      });
      expect(empty.success).toBe(false);

      // 21 món -> Bị chặn (vượt quá 20 món/đơn)
      const tooManyItems = Array.from({ length: 21 }, () => ({
        dishId: "ca-hoi-sot-chanh",
        grams: 300,
      }));
      const overLimit = orderCreationSchema.safeParse({
        customerName: "Nguyễn Văn A",
        phone: "0912345678",
        address: "123 Lê Lợi, Quận 1",
        items: tooManyItems,
      });
      expect(overLimit.success).toBe(false);
    });

    it("rejects invalid grams", () => {
      // Grams âm hoặc bằng 0
      const invalidGrams = orderCreationSchema.safeParse({
        customerName: "Nguyễn Văn A",
        phone: "0912345678",
        address: "123 Lê Lợi, Quận 1",
        items: [{ dishId: "ca-hoi-sot-chanh", grams: -50 }],
      });
      expect(invalidGrams.success).toBe(false);

      const zeroGrams = orderCreationSchema.safeParse({
        customerName: "Nguyễn Văn A",
        phone: "0912345678",
        address: "123 Lê Lợi, Quận 1",
        items: [{ dishId: "ca-hoi-sot-chanh", grams: 0 }],
      });
      expect(zeroGrams.success).toBe(false);
    });

    it("validates USDA search query string length", () => {
      expect(usdaSearchQuerySchema.safeParse({ q: "" }).success).toBe(false);
      expect(usdaSearchQuerySchema.safeParse({ q: "salmon" }).success).toBe(true);
      expect(usdaSearchQuerySchema.safeParse({ q: "a".repeat(101) }).success).toBe(false);
    });
  });

  describe("3. Admin Authentication & HMAC Session Tokens", () => {
    it("signs and verifies HMAC session token correctly", () => {
      const token = signSessionToken({
        exp: Date.now() + 12 * 60 * 60 * 1000,
        role: "admin",
      });

      expect(typeof token).toBe("string");
      expect(token).toContain(".");
      expect(verifySessionToken(token)).toBe(true);
    });

    it("rejects tampered HMAC tokens", () => {
      const token = signSessionToken({
        exp: Date.now() + 12 * 60 * 60 * 1000,
        role: "admin",
      });

      const [data, sig] = token.split(".");
      // Làm sai chữ ký
      const tamperedSig = sig.slice(0, -2) + "xx";
      expect(verifySessionToken(`${data}.${tamperedSig}`)).toBe(false);

      // Làm sai payload
      const tamperedData = Buffer.from(JSON.stringify({ exp: Date.now() + 999999, role: "superadmin" })).toString("base64url");
      expect(verifySessionToken(`${tamperedData}.${sig}`)).toBe(false);
    });

    it("rejects expired HMAC tokens", () => {
      const expiredToken = signSessionToken({
        exp: Date.now() - 1000, // Đã hết hạn
        role: "admin",
      });
      expect(verifySessionToken(expiredToken)).toBe(false);
    });

    it("verifies admin passcode using timingSafeEqual", () => {
      process.env.ADMIN_PASSCODE = "admin_super_secret_passcode_123";

      expect(verifyAdminPasscode("admin_super_secret_passcode_123")).toBe(true);
      expect(verifyAdminPasscode("wrong_passcode")).toBe(false);
      expect(verifyAdminPasscode("")).toBe(false);
    });
  });
});
