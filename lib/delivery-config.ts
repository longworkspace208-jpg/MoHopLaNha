export interface ServiceDistrict {
  district: string;
  aliases: string[];
  wards?: string[];
}

export const DELIVERY_CONFIG = {
  // Phí giao hàng cố định tính theo VND
  shippingFeeVnd: 15000,

  // Danh sách các quận/huyện trong vùng phục vụ (khu vực TP. Hồ Chí Minh)
  serviceDistricts: [
    {
      district: "Quận 1",
      aliases: ["quan 1", "q1", "q.1", "dist 1", "district 1"],
      wards: ["Bến Nghé", "Bến Thành", "Cô Giang", "Cầu Kho", "Cầu Ông Lãnh", "Đa Kao", "Nguyễn Cư Trinh", "Nguyễn Thái Bình", "Phạm Ngũ Lão", "Tân Định"]
    },
    {
      district: "Quận 3",
      aliases: ["quan 3", "q3", "q.3", "dist 3", "district 3"],
      wards: ["Phường 1", "Phường 2", "Phường 3", "Phường 4", "Phường 5", "Phường 9", "Phường 11", "Phường 12", "Phường 14", "Võ Thị Sáu"]
    },
    {
      district: "Quận 4",
      aliases: ["quan 4", "q4", "q.4", "dist 4", "district 4"],
      wards: ["Phường 1", "Phường 2", "Phường 3", "Phường 4", "Phường 6", "Phường 8", "Phường 9", "Phường 10", "Phường 13", "Phường 14", "Phường 15", "Phường 16", "Phường 18"]
    },
    {
      district: "Bình Thạnh",
      aliases: ["binh thanh", "q binh thanh", "quan binh thanh"],
      wards: ["Phường 1", "Phường 2", "Phường 3", "Phường 5", "Phường 6", "Phường 7", "Phường 11", "Phường 12", "Phường 13", "Phường 14", "Phường 15", "Phường 17", "Phường 19", "Phường 21", "Phường 22", "Phường 24", "Phường 25", "Phường 26", "Phường 27", "Phường 28"]
    },
    {
      district: "Phú Nhuận",
      aliases: ["phu nhuan", "q phu nhuan", "quan phu nhuan"],
      wards: ["Phường 1", "Phường 2", "Phường 3", "Phường 4", "Phường 5", "Phường 7", "Phường 8", "Phường 9", "Phường 10", "Phường 11", "Phường 13", "Phường 15", "Phường 17"]
    }
  ] as ServiceDistrict[]
};

/**
 * Chuẩn hóa chuỗi tiếng Việt: bỏ dấu, viết thường, loại bỏ ký tự đặc biệt
 */
export function normalizeVietnamese(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "d")
    .toLowerCase()
    .trim();
}

export interface ValidationResult {
  inService: boolean;
  matchedDistrict?: string;
  message?: string;
}

/**
 * Kiểm tra địa chỉ có nằm trong vùng phục vụ hay không
 */
export function validateServiceArea(address: string): ValidationResult {
  const trimmed = address.trim();
  if (!trimmed) {
    return {
      inService: false,
      message: "Vui lòng nhập địa chỉ nhận hàng."
    };
  }

  const normalized = normalizeVietnamese(trimmed);

  for (const item of DELIVERY_CONFIG.serviceDistricts) {
    const primaryNormalized = normalizeVietnamese(item.district);
    if (normalized.includes(primaryNormalized)) {
      return { inService: true, matchedDistrict: item.district };
    }

    for (const alias of item.aliases) {
      // Regex boundary hoặc contains từ khóa alias
      const escapedAlias = alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const regex = new RegExp(`(^|\\b|\\s|[,/-])${escapedAlias}(\\b|\\s|[,/-]|$)`, "i");
      if (regex.test(normalized)) {
        return { inService: true, matchedDistrict: item.district };
      }
    }
  }

  const supportedNames = DELIVERY_CONFIG.serviceDistricts.map((d) => d.district).join(", ");
  return {
    inService: false,
    message: `Địa chỉ ngoài vùng phục vụ. Mở Hộp Là Nhà hiện chỉ phục vụ tại: ${supportedNames}.`
  };
}

