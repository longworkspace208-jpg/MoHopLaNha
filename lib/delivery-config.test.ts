import { describe, expect, it } from "vitest";
import { validateServiceArea } from "./delivery-config";

describe("delivery service area validation (Hanoi 20km radius from 91 Chùa Láng)", () => {
  it("approves valid address in Dong Da (near 91 Chùa Láng)", () => {
    const res = validateServiceArea("91 Chùa Láng, Phường Láng Thượng, Quận Đống Đa, Hà Nội");
    expect(res.inService).toBe(true);
    expect(res.matchedDistrict).toBe("Đống Đa");
  });

  it("approves valid address in Cau Giay", () => {
    const res = validateServiceArea("12 Cầu Giấy, Dịch Vọng, Cầu Giấy, Hà Nội");
    expect(res.inService).toBe(true);
    expect(res.matchedDistrict).toBe("Cầu Giấy");
  });

  it("approves valid address in Ba Dinh", () => {
    const res = validateServiceArea("54 Liễu Giai, Ba Đình, Hà Nội");
    expect(res.inService).toBe(true);
    expect(res.matchedDistrict).toBe("Ba Đình");
  });

  it("approves valid address with landmark (Keangnam Landmark)", () => {
    const res = validateServiceArea("Tòa Keangnam, Phạm Hùng, Nam Từ Liêm, Hà Nội");
    expect(res.inService).toBe(true);
    expect(res.matchedDistrict).toBe("Nam Từ Liêm");
  });

  it("approves valid general address in Hanoi", () => {
    const res = validateServiceArea("Số 15 Phố Duy Tân, Hà Nội");
    expect(res.inService).toBe(true);
  });

  it("rejects addresses in distant cities (TP.HCM)", () => {
    const res = validateServiceArea("123 Lê Lợi, Phường Bến Nghé, Quận 1, TP.HCM");
    expect(res.inService).toBe(false);
    expect(res.message).toContain("Địa chỉ ngoài vùng phục vụ");
  });

  it("rejects addresses in Da Nang", () => {
    const res = validateServiceArea("Bạch Đằng, Quận Hải Châu, Đà Nẵng");
    expect(res.inService).toBe(false);
    expect(res.message).toContain("Địa chỉ ngoài vùng phục vụ");
  });

  it("rejects empty address", () => {
    const res = validateServiceArea("");
    expect(res.inService).toBe(false);
    expect(res.message).toContain("Vui lòng nhập địa chỉ");
  });
});
