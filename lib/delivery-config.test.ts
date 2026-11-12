import { describe, expect, it } from "vitest";
import { validateServiceArea } from "./delivery-config";

describe("delivery service area validation", () => {
  it("approves valid address in District 1", () => {
    const res = validateServiceArea("123 Lê Lợi, Phường Bến Nghé, Quận 1");
    expect(res.inService).toBe(true);
    expect(res.matchedDistrict).toBe("Quận 1");
  });

  it("approves valid address with lowercase / abbreviation q1", () => {
    const res = validateServiceArea("Số 10 Nguyễn Huệ, q1, tphcm");
    expect(res.inService).toBe(true);
    expect(res.matchedDistrict).toBe("Quận 1");
  });

  it("approves valid address in Binh Thanh", () => {
    const res = validateServiceArea("45 Ung Văn Khiêm, Phường 25, Bình Thạnh");
    expect(res.inService).toBe(true);
    expect(res.matchedDistrict).toBe("Bình Thạnh");
  });

  it("approves valid address in Phu Nhuan", () => {
    const res = validateServiceArea("88 Phan Xích Long, Phú Nhuận");
    expect(res.inService).toBe(true);
    expect(res.matchedDistrict).toBe("Phú Nhuận");
  });

  it("rejects addresses outside service area", () => {
    const res = validateServiceArea("12 Cầu Giấy, Hà Nội");
    expect(res.inService).toBe(false);
    expect(res.message).toContain("Địa chỉ ngoài vùng phục vụ");
  });

  it("rejects unsupported districts in HCM", () => {
    const res = validateServiceArea("Ấp Bắc, Tân Bình");
    expect(res.inService).toBe(false);
    expect(res.message).toContain("Địa chỉ ngoài vùng phục vụ");
  });

  it("rejects empty address", () => {
    const res = validateServiceArea("");
    expect(res.inService).toBe(false);
    expect(res.message).toContain("Vui lòng nhập địa chỉ");
  });
});

