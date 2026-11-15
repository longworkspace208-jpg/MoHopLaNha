export interface ServiceDistrict {
  district: string;
  aliases: string[];
  wards?: string[];
}

export const DELIVERY_CONFIG = {
  // Phí giao hàng cố định tính theo VND
  shippingFeeVnd: 15000,

  // Thông tin cửa hàng trung tâm
  storeAddress: "91 Chùa Láng, Đống Đa, Hà Nội",
  storeLat: 21.022503,
  storeLng: 105.805148,
  maxDistanceM: 20000, // Bán kính phục vụ 20km

  // Danh sách các quận/huyện trong vùng phục vụ (Hà Nội và bán kính 20km từ 91 Chùa Láng)
  serviceDistricts: [
    {
      district: "Đống Đa",
      aliases: [
        "dong da",
        "q dong da",
        "quan dong da",
        "chua lang",
        "lang thuong",
        "lang ha",
        "kim ma",
        "thai ha",
        "chua boc",
        "xa dan",
        "ton duc thang",
        "o cho dua",
        "cat linh",
        "van mieu",
        "nguyen chi thanh",
        "huynh thuc khang",
        "duong lang",
        "tay son",
        "hoang cau",
        "dang van ngu",
        "pham ngoc thach"
      ],
      wards: [
        "Láng Thượng",
        "Láng Hạ",
        "Quang Trung",
        "Trung Liệt",
        "Kim Liên",
        "Phương Mai",
        "Ô Chợ Dừa",
        "Cát Linh",
        "Văn Miếu",
        "Quốc Tử Giám",
        "Nam Đồng"
      ]
    },
    {
      district: "Cầu Giấy",
      aliases: [
        "cau giay",
        "q cau giay",
        "quan cau giay",
        "xuan thuy",
        "duy tan",
        "tran thai tong",
        "tran duy hung",
        "nguyen phong sac",
        "hoang quoc viet",
        "nguyen khang",
        "trung hoa",
        "dich vong",
        "mai dich",
        "nghia do",
        "nghia tan",
        "trung kinh",
        "vu pham ham",
        "nguyen thi thap",
        "to hieu"
      ],
      wards: [
        "Dịch Vọng",
        "Dịch Vọng Hậu",
        "Trung Hòa",
        "Nghĩa Đô",
        "Nghĩa Tân",
        "Mai Dịch",
        "Quan Hoa",
        "Yên Hòa"
      ]
    },
    {
      district: "Ba Đình",
      aliases: [
        "ba dinh",
        "q ba dinh",
        "quan ba dinh",
        "kim ma",
        "lieu giai",
        "doi can",
        "giang vo",
        "ngoc khanh",
        "doc ngu",
        "quan thanh",
        "phan dinh phung",
        "hoang hoa tham"
      ],
      wards: [
        "Cống Vị",
        "Điện Biên",
        "Đội Cấn",
        "Giảng Võ",
        "Kim Mã",
        "Liễu Giai",
        "Ngọc Hà",
        "Ngọc Khánh",
        "Nguyễn Trung Trực",
        "Phúc Xá",
        "Quán Thánh",
        "Thành Công",
        "Trúc Bạch",
        "Vĩnh Phúc"
      ]
    },
    {
      district: "Thanh Xuân",
      aliases: [
        "thanh xuan",
        "q thanh xuan",
        "quan thanh xuan",
        "nguyen trai",
        "khuat duy tien",
        "le van luong",
        "hoang dao thuy",
        "nhan chinh",
        "nguyen tuan",
        "vu trong phung",
        "ha dinh",
        "khuong dinh",
        "khuong mai",
        "khuong trung"
      ],
      wards: [
        "Hạ Đình",
        "Kim Giang",
        "Khương Đình",
        "Khương Mai",
        "Khương Trung",
        "Nhân Chính",
        "Phương Liệt",
        "Thanh Xuân Bắc",
        "Thanh Xuân Nam",
        "Thanh Xuân Trung",
        "Thượng Đình"
      ]
    },
    {
      district: "Hoàn Kiếm",
      aliases: [
        "hoan kiem",
        "q hoan kiem",
        "quan hoan kiem",
        "trang thi",
        "hang bai",
        "hang trong",
        "hang bong",
        "dinh tien hoang",
        "ly thai to",
        "phan chu trinh",
        "cua nam",
        "pho co",
        "ho guom"
      ],
      wards: [
        "Chương Dương",
        "Cửa Đông",
        "Cửa Nam",
        "Đồng Xuân",
        "Hàng Bạc",
        "Hàng Bài",
        "Hàng Bồ",
        "Hàng Bông",
        "Hàng Buồm",
        "Hàng Đào",
        "Hàng Gai",
        "Hàng Mã",
        "Hàng Trống",
        "Lý Thái Tổ",
        "Phan Chu Trinh",
        "Phúc Tân",
        "Trần Hưng Đạo",
        "Tràng Tiền"
      ]
    },
    {
      district: "Hai Bà Trưng",
      aliases: [
        "hai ba trung",
        "q hai ba trung",
        "quan hai ba trung",
        "ba trieu",
        "pho hue",
        "bach mai",
        "dai co viet",
        "minh khai",
        "truong dinh",
        "vinh tuy",
        "times city"
      ],
      wards: [
        "Bạch Đằng",
        "Bách Khoa",
        "Bạch Mai",
        "Cầu Dền",
        "Đống Mác",
        "Đồng Nhân",
        "Đồng Tâm",
        "Lê Đại Hành",
        "Minh Khai",
        "Nguyễn Du",
        "Phạm Đình Hổ",
        "Phố Huế",
        "Quỳnh Lôi",
        "Quỳnh Mai",
        "Thanh Lương",
        "Thanh Nhàn",
        "Trương Định",
        "Vĩnh Tuy"
      ]
    },
    {
      district: "Tây Hồ",
      aliases: [
        "tay ho",
        "q tay ho",
        "quan tay ho",
        "lac long quan",
        "thuy khue",
        "hoang hoa tham",
        "quang an",
        "nhat tan",
        "yen phu",
        "buoi",
        "xuan la",
        "vo chi cong"
      ],
      wards: [
        "Bưởi",
        "Nhật Tân",
        "Phú Thượng",
        "Quảng An",
        "Thụy Khuê",
        "Tứ Liên",
        "Xuân La",
        "Yên Phụ"
      ]
    },
    {
      district: "Nam Từ Liêm",
      aliases: [
        "nam tu liem",
        "q nam tu liem",
        "quan nam tu liem",
        "my dinh",
        "pham hung",
        "me tri",
        "le duc tho",
        "cau dien",
        "tay mo",
        "dai mo",
        "trung van",
        "keangnam",
        "smart city"
      ],
      wards: [
        "Cầu Diễn",
        "Đại Mỗ",
        "Mễ Trì",
        "Mỹ Đình 1",
        "Mỹ Đình 2",
        "Phú Đô",
        "Phương Canh",
        "Tây Mỗ",
        "Trung Văn",
        "Xuân Phương"
      ]
    },
    {
      district: "Bắc Từ Liêm",
      aliases: [
        "bac tu liem",
        "q bac tu liem",
        "quan bac tu liem",
        "co nhue",
        "xuan dinh",
        "dong ngac",
        "phu dien",
        "pham van dong"
      ],
      wards: [
        "Cổ Nhuế 1",
        "Cổ Nhuế 2",
        "Đông Ngạc",
        "Đức Thắng",
        "Liên Mạc",
        "Minh Khai",
        "Phú Diễn",
        "Phúc Diễn",
        "Tây Tựu",
        "Thượng Cát",
        "Thụy Phương",
        "Xuân Đỉnh",
        "Xuân Tảo"
      ]
    },
    {
      district: "Hoàng Mai",
      aliases: [
        "hoang mai",
        "q hoang mai",
        "quan hoang mai",
        "dinh cong",
        "linh dam",
        "giai phong",
        "tam trinh",
        "mai dong",
        "hoang liet",
        "giap bat"
      ],
      wards: [
        "Đại Kim",
        "Định Công",
        "Giáp Bát",
        "Hoàng Liệt",
        "Hoàng Văn Thụ",
        "Lĩnh Nam",
        "Mai Động",
        "Tân Mai",
        "Thanh Trì",
        "Thịnh Liệt",
        "Trần Phú",
        "Tương Mai",
        "Vĩnh Hưng",
        "Yên Sở"
      ]
    },
    {
      district: "Hà Đông",
      aliases: [
        "ha dong",
        "q ha dong",
        "quan ha dong",
        "quang trung",
        "van quan",
        "mo lao",
        "tran phu",
        "ha cau",
        "la khe",
        "kien hung",
        "yen nghia",
        "duong noi"
      ],
      wards: [
        "Biên Giang",
        "Đồng Mai",
        "Dương Nội",
        "Hà Cầu",
        "Kiến Hưng",
        "La Khê",
        "Mộ Lao",
        "Nguyễn Trãi",
        "Phú La",
        "Phú Lãm",
        "Phú Lương",
        "Phúc La",
        "Quang Trung",
        "Vạn Phúc",
        "Văn Quán",
        "Yên Nghĩa",
        "Yết Kiêu"
      ]
    },
    {
      district: "Long Biên",
      aliases: [
        "long bien",
        "q long bien",
        "quan long bien",
        "nguyen van cu",
        "ngoc lam",
        "bo de",
        "sai dong",
        "co linh"
      ],
      wards: [
        "Bồ Đề",
        "Cự Khối",
        "Đức Giang",
        "Gia Thụy",
        "Giang Biên",
        "Long Biên",
        "Ngọc Lâm",
        "Ngọc Thụy",
        "Phúc Đồng",
        "Phúc Lợi",
        "Sài Đồng",
        "Thạch Bàn",
        "Thượng Thanh",
        "Việt Hưng"
      ]
    },
    {
      district: "Ngoại thành (trong bán kính 20km)",
      aliases: ["thanh tri", "huyen thanh tri", "gia lam", "huyen gia lam", "hoai duc", "dan phuong", "dong anh"],
      wards: []
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
 * Các khu vực cách xa Hà Nội hơn 20km cần từ chối sớm
 */
const DISTANT_REGIONS = [
  "tp hcm",
  "tphcm",
  "tp.hcm",
  "ho chi minh",
  "sai gon",
  "saigon",
  "da nang",
  "can tho",
  "hai phong",
  "nha trang",
  "binh duong",
  "dong nai",
  "vung tau",
  "hue",
  "quang ninh",
  "bac ninh",
  "thai nguyen"
];

/**
 * Kiểm tra địa chỉ có nằm trong vùng phục vụ (bán kính 20km quanh 91 Chùa Láng, Hà Nội)
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

  // 1. Kiểm tra các tỉnh thành xa ngoài vùng phục vụ
  for (const region of DISTANT_REGIONS) {
    const escaped = region.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(`(^|\\b|\\s|[,/-])${escaped}(\\b|\\s|[,/-]|$)`, "i");
    if (regex.test(normalized)) {
      return {
        inService: false,
        message:
          "Địa chỉ ngoài vùng phục vụ. Mở Hộp Là Nhà hiện chỉ phục vụ giao hàng trong bán kính 20km từ 91 Chùa Láng, Đống Đa, Hà Nội."
      };
    }
  }

  // 2. Kiểm tra các quận/huyện/tuyến phố thuộc vùng phục vụ Hà Nội
  for (const item of DELIVERY_CONFIG.serviceDistricts) {
    const primaryNormalized = normalizeVietnamese(item.district);
    if (normalized.includes(primaryNormalized)) {
      return { inService: true, matchedDistrict: item.district };
    }

    for (const alias of item.aliases) {
      const escapedAlias = alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const regex = new RegExp(`(^|\\b|\\s|[,/-])${escapedAlias}(\\b|\\s|[,/-]|$)`, "i");
      if (regex.test(normalized)) {
        return { inService: true, matchedDistrict: item.district };
      }
    }
  }

  // 3. Nếu địa chỉ có chứa 'Hà Nội' hoặc 'HN'
  if (
    normalized.includes("ha noi") ||
    normalized.includes("hanoi") ||
    /(^|\b|\s|[,/-])hn(\b|\s|[,/-]|$)/i.test(normalized)
  ) {
    return {
      inService: true,
      matchedDistrict: "Hà Nội (trong bán kính 20km)"
    };
  }

  // 4. Nếu địa chỉ hợp lệ (độ dài >= 5 ký tự) và không thuộc tỉnh xa, chấp nhận mặc định trong bán kính phục vụ
  if (trimmed.length >= 5) {
    return {
      inService: true,
      matchedDistrict: "Hà Nội & lân cận (bán kính 20km)"
    };
  }

  return {
    inService: false,
    message: "Vui lòng nhập địa chỉ chi tiết hơn (số nhà, tên đường, phường/quận tại Hà Nội)."
  };
}
