import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  haversineDistanceMeters,
  checkDeliveryDistance,
  clearDeliveryCheckCache,
  searchLocalHanoiLocations,
  fetchGoongAutoComplete,
  type GoongConfig,
} from "./goong";

describe("Goong Delivery & 20km Range Check Suite", () => {
  const mockConfig: GoongConfig = {
    apiKey: "test-goong-api-key",
    storeAddress: "91 Chùa Láng, Đống Đa, Hà Nội",
    storeLat: 21.022503,
    storeLng: 105.805148,
    maxDistanceM: 20000,
    vehicle: "bike",
  };

  beforeEach(() => {
    clearDeliveryCheckCache();
    vi.restoreAllMocks();
  });

  describe("1. Hàm Haversine tính toán khoảng cách đường chim bay", () => {
    it("trả về 0 khi hai tọa độ trùng nhau", () => {
      const dist = haversineDistanceMeters(21.022503, 105.805148, 21.022503, 105.805148);
      expect(dist).toBe(0);
    });

    it("tính chính xác khoảng cách từ 91 Chùa Láng đến Hồ Hoàn Kiếm (~5.1km)", () => {
      // Hồ Hoàn Kiếm (21.028511, 105.854444)
      const dist = haversineDistanceMeters(21.022503, 105.805148, 21.028511, 105.854444);
      expect(dist).toBeGreaterThanOrEqual(5100);
      expect(dist).toBeLessThanOrEqual(5250);
    });

    it("tính chính xác khoảng cách từ Hà Nội đến TP.HCM (~1.140km)", () => {
      // TP.HCM (10.7769, 106.7009)
      const dist = haversineDistanceMeters(21.022503, 105.805148, 10.7769, 106.7009);
      expect(dist).toBeGreaterThanOrEqual(1140000);
      expect(dist).toBeLessThanOrEqual(1150000);
    });
  });

  describe("2. Kiểm tra các trường hợp ngay sát ngưỡng 20km (19.9km và 20.1km)", () => {
    it("chấp nhận giao hàng khi khoảng cách ngay sát ngưỡng dưới (19.9km = 19.900m)", async () => {
      // Điểm cách cửa hàng chính xác 19.900m về phía Bắc
      const lat19_9 = 21.022503 + (19900 / 6371000) * (180 / Math.PI);
      const lng19_9 = 105.805148;

      const haversine = haversineDistanceMeters(mockConfig.storeLat, mockConfig.storeLng, lat19_9, lng19_9);
      expect(haversine).toBe(19900);

      // Mock Goong Distance Matrix trả về quãng đường thực tế 19.950m (<= 20.000m)
      const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: "OK",
          rows: [
            {
              elements: [
                {
                  status: "OK",
                  distance: { value: 19950, text: "19.9 km" },
                  duration: { value: 2400, text: "40 phút" },
                },
              ],
            },
          ],
        }),
      } as Response);

      const res = await checkDeliveryDistance({
        lat: lat19_9,
        lng: lng19_9,
        config: mockConfig,
      });

      expect(fetchSpy).toHaveBeenCalled(); // Phải gọi Distance Matrix vì qua bước lọc Haversine
      expect(res.deliverable).toBe(true);
      expect(res.distance_m).toBe(19950);
      expect(res.reason).toContain("Nằm trong phạm vi giao hàng");
    });

    it("từ chối giao hàng ngay ở bước lọc Haversine khi vượt ngưỡng (20.1km = 20.100m)", async () => {
      // Điểm cách cửa hàng chính xác 20.100m về phía Bắc
      const lat20_1 = 21.022503 + (20100 / 6371000) * (180 / Math.PI);
      const lng20_1 = 105.805148;

      const haversine = haversineDistanceMeters(mockConfig.storeLat, mockConfig.storeLng, lat20_1, lng20_1);
      expect(haversine).toBe(20100);

      const fetchSpy = vi.spyOn(globalThis, "fetch");

      const res = await checkDeliveryDistance({
        lat: lat20_1,
        lng: lng20_1,
        config: mockConfig,
      });

      // KHÔNG được gọi Goong Distance Matrix để tiết kiệm quota
      expect(fetchSpy).not.toHaveBeenCalled();
      expect(res.deliverable).toBe(false);
      expect(res.distance_m).toBe(20100);
      expect(res.reason).toContain("vượt quá bán kính phục vụ 20km");
    });
  });

  describe("3. Địa chỉ ngoài Hà Nội (lọc sơ bộ không tốn quota API)", () => {
    it("từ chối ngay điểm giao tại TP. Hồ Chí Minh mà không gọi API tiếp", async () => {
      const fetchSpy = vi.spyOn(globalThis, "fetch");

      const res = await checkDeliveryDistance({
        lat: 10.7769,
        lng: 106.7009,
        address: "Quận 1, TP. Hồ Chí Minh",
        config: mockConfig,
      });

      expect(fetchSpy).not.toHaveBeenCalled();
      expect(res.deliverable).toBe(false);
      expect(res.distance_m).toBeGreaterThan(1000000);
      expect(res.reason).toContain("vượt quá bán kính phục vụ 20km");
    });

    it("từ chối ngay điểm giao tại Thành phố Hải Phòng", async () => {
      const fetchSpy = vi.spyOn(globalThis, "fetch");

      const res = await checkDeliveryDistance({
        lat: 20.8449,
        lng: 106.6881,
        address: "Hải Phòng",
        config: mockConfig,
      });

      expect(fetchSpy).not.toHaveBeenCalled();
      expect(res.deliverable).toBe(false);
      expect(res.distance_m).toBeGreaterThan(90000);
    });
  });

  describe("4. Xử lý lỗi và Fallback khi Goong API lỗi (429/timeout/hỏng mạng)", () => {
    it("fallback về Haversine với cờ approximate: true khi Goong trả về lỗi 429", async () => {
      // Tọa độ gần tại Cầu Giấy (~2km)
      const latNear = 21.0333;
      const lngNear = 105.7999;

      // Mock fetch trả về lỗi 429 Too Many Requests
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
        ok: false,
        status: 429,
        statusText: "Too Many Requests",
      } as Response);

      const res = await checkDeliveryDistance({
        lat: latNear,
        lng: lngNear,
        config: mockConfig,
      });

      // Không được chặn đặt hàng im lặng! Phải chấp nhận đơn với cờ approximate
      expect(res.deliverable).toBe(true);
      expect(res.approximate).toBe(true);
      expect(res.distance_m).toBeGreaterThan(0);
      expect(res.reason).toContain("chế độ dự phòng");
    });

    it("fallback về Haversine khi fetch bị timeout hoặc lỗi mạng", async () => {
      const latNear = 21.0333;
      const lngNear = 105.7999;

      vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(new Error("Network timeout"));

      const res = await checkDeliveryDistance({
        lat: latNear,
        lng: lngNear,
        config: mockConfig,
      });

      expect(res.deliverable).toBe(true);
      expect(res.approximate).toBe(true);
      expect(res.reason).toContain("chế độ dự phòng");
    });
  });

  describe("5. Autocomplete gợi ý địa chỉ Hà Nội (Local & Fallback)", () => {
    it("gợi ý chính xác địa chỉ Chùa Láng và FTU khi khách gõ 'Chùa Láng'", () => {
      const results = searchLocalHanoiLocations("Chùa Láng");
      expect(results.length).toBeGreaterThan(0);
      const hasChuaLang = results.some(
        (r) => r.description.includes("Chùa Láng") || r.main_text.includes("Chùa Láng")
      );
      expect(hasChuaLang).toBe(true);
    });

    it("gợi ý số nhà khi khách gõ kèm số nhà '12 Cầu Giấy'", () => {
      const results = searchLocalHanoiLocations("12 Cầu Giấy");
      expect(results.length).toBeGreaterThan(0);
      const matched = results.find((r) => r.main_text.includes("12"));
      expect(matched).toBeDefined();
      expect(matched?.secondary_text).toContain("Cầu Giấy");
    });

    it("gợi ý trường đại học theo từ viết tắt 'FTU'", () => {
      const results = searchLocalHanoiLocations("FTU");
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].description).toContain("Ngoại Thương");
    });

    it("fetchGoongAutoComplete trả về gợi ý ngay cả khi không có Goong API Key", async () => {
      const emptyKeyConfig: GoongConfig = {
        ...mockConfig,
        apiKey: "",
      };

      const results = await fetchGoongAutoComplete("Duy Tân", emptyKeyConfig);
      expect(results.length).toBeGreaterThan(0);
      expect(results.some((r) => r.description.includes("Duy Tân"))).toBe(true);
    });
  });
});
