import "server-only";
import { normalizeVietnamese, validateServiceArea } from "./delivery-config";

export interface GoongConfig {
  apiKey: string;
  storeAddress: string;
  storeLat: number;
  storeLng: number;
  maxDistanceM: number;
  vehicle: "bike" | "car" | "motorcycle" | "truck";
}

export interface DeliveryCheckResult {
  deliverable: boolean;
  distance_m: number;
  duration_s: number;
  reason: string;
  approximate?: boolean;
  lat?: number;
  lng?: number;
  formattedAddress?: string;
}

export interface AutoCompletePrediction {
  place_id: string;
  description: string;
  main_text: string;
  secondary_text: string;
  lat?: number;
  lng?: number;
}

export function getGoongConfig(): GoongConfig {
  return {
    apiKey: process.env.GOONG_API_KEY || "",
    storeAddress: process.env.STORE_ADDRESS || "91 Chùa Láng, Đống Đa, Hà Nội",
    storeLat: Number(process.env.STORE_LAT || 21.022503),
    storeLng: Number(process.env.STORE_LNG || 105.805148),
    maxDistanceM: Number(process.env.DELIVERY_MAX_DISTANCE_M || 20000),
    vehicle: (process.env.DELIVERY_VEHICLE as GoongConfig["vehicle"]) || "bike",
  };
}

/**
 * Tính khoảng cách cung tròn (đường chim bay) theo công thức Haversine
 * Đơn vị trả về: mét (m)
 */
export function haversineDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000; // Bán kính Trái Đất trung bình theo mét
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

// In-memory cache lưu kết quả kiểm tra theo place_id để tiết kiệm quota Goong Distance Matrix
interface CacheEntry {
  result: DeliveryCheckResult;
  timestamp: number;
}
const checkCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 60 * 60 * 1000; // TTL 1 giờ

// Bộ nhớ đệm lưu tọa độ các địa điểm đã biết (Goong, Local dataset, OSM)
const knownPlaces = new Map<string, { lat: number; lng: number; formattedAddress: string }>();

export function clearDeliveryCheckCache() {
  checkCache.clear();
  knownPlaces.clear();
}

/**
 * Danh mục địa điểm, trường đại học, bệnh viện, tòa nhà & các tuyến đường chính tại Hà Nội
 * phục vụ autocomplete dự phòng khi chưa cấu hình GOONG_API_KEY hoặc Goong API không phản hồi.
 */
interface LocalHanoiPoint {
  id: string;
  name: string;
  address: string;
  ward: string;
  district: string;
  lat: number;
  lng: number;
  aliases: string[];
}

const HANOI_DIRECTORY: LocalHanoiPoint[] = [
  // Cửa hàng & khu vực lân cận Chùa Láng
  {
    id: "loc_chua_lang_91",
    name: "91 Chùa Láng (Cửa hàng Mở Hộp Là Nhà)",
    address: "91 Chùa Láng, Phường Láng Thượng, Quận Đống Đa, Hà Nội",
    ward: "Phường Láng Thượng",
    district: "Quận Đống Đa",
    lat: 21.022503,
    lng: 105.805148,
    aliases: ["91 chua lang", "chua lang", "lang thuong", "mo hop la nha"],
  },
  {
    id: "loc_ftu",
    name: "Đại học Ngoại Thương (FTU) - 91 Chùa Láng",
    address: "91 Chùa Láng, Phường Láng Thượng, Quận Đống Đa, Hà Nội",
    ward: "Phường Láng Thượng",
    district: "Quận Đống Đa",
    lat: 21.0225,
    lng: 105.8051,
    aliases: ["ftu", "ngoai thuong", "dai hoc ngoai thuong", "truong ngoai thuong"],
  },
  {
    id: "loc_dav",
    name: "Học viện Ngoại Giao (DAV) - 69 Chùa Láng",
    address: "69 Chùa Láng, Phường Láng Thượng, Quận Đống Đa, Hà Nội",
    ward: "Phường Láng Thượng",
    district: "Quận Đống Đa",
    lat: 21.0238,
    lng: 105.8062,
    aliases: ["dav", "ngoai giao", "hoc vien ngoai giao", "69 chua lang"],
  },
  {
    id: "loc_luat",
    name: "Trường Đại học Luật Hà Nội - 87 Nguyễn Chí Thanh",
    address: "87 Nguyễn Chí Thanh, Phường Láng Thượng, Quận Đống Đa, Hà Nội",
    ward: "Phường Láng Thượng",
    district: "Quận Đống Đa",
    lat: 21.021,
    lng: 105.8085,
    aliases: ["dai hoc luat", "dh luat", "87 nguyen chi thanh", "luat ha noi"],
  },
  {
    id: "loc_bv_giao_thong",
    name: "Bệnh viện Giao Thông Vận Tải - Ngõ 84 Chùa Láng",
    address: "Ngõ 84 Chùa Láng, Phường Láng Thượng, Quận Đống Đa, Hà Nội",
    ward: "Phường Láng Thượng",
    district: "Quận Đống Đa",
    lat: 21.025,
    lng: 105.803,
    aliases: ["benh vien giao thong", "bv giao thong van tai", "84 chua lang"],
  },
  {
    id: "loc_vincom_nct",
    name: "Vincom Center Nguyễn Chí Thanh - 54A Nguyễn Chí Thanh",
    address: "54A Nguyễn Chí Thanh, Phường Láng Thượng, Quận Đống Đa, Hà Nội",
    ward: "Phường Láng Thượng",
    district: "Quận Đống Đa",
    lat: 21.023,
    lng: 105.8115,
    aliases: ["vincom nguyen chi thanh", "vincom nct", "54a nguyen chi thanh"],
  },
  {
    id: "loc_bv_nhi",
    name: "Bệnh viện Nhi Trung Ương - 18/879 La Thành",
    address: "18/879 La Thành, Phường Láng Thượng, Quận Đống Đa, Hà Nội",
    ward: "Phường Láng Thượng",
    district: "Quận Đống Đa",
    lat: 21.026,
    lng: 105.811,
    aliases: ["bv nhi", "benh vien nhi trung uong", "nhi trung uong", "de la thanh"],
  },
  {
    id: "loc_bv_phu_san",
    name: "Bệnh viện Phụ Sản Hà Nội - 929 La Thành",
    address: "929 La Thành, Phường Ngọc Khánh, Quận Ba Đình, Hà Nội",
    ward: "Phường Ngọc Khánh",
    district: "Quận Ba Đình",
    lat: 21.027,
    lng: 105.81,
    aliases: ["bv phu san", "benh vien phu san", "phu san ha noi"],
  },

  // Các tuyến phố chính quận Đống Đa
  {
    id: "loc_pho_chua_lang",
    name: "Phố Chùa Láng",
    address: "Phố Chùa Láng, Phường Láng Thượng, Quận Đống Đa, Hà Nội",
    ward: "Phường Láng Thượng",
    district: "Quận Đống Đa",
    lat: 21.023,
    lng: 105.8055,
    aliases: ["chua lang", "pho chua lang", "duong chua lang"],
  },
  {
    id: "loc_duong_lang",
    name: "Đường Láng",
    address: "Đường Láng, Phường Láng Thượng, Quận Đống Đa, Hà Nội",
    ward: "Phường Láng Thượng",
    district: "Quận Đống Đa",
    lat: 21.015,
    lng: 105.808,
    aliases: ["duong lang", "lang"],
  },
  {
    id: "loc_nguyen_chi_thanh",
    name: "Đường Nguyễn Chí Thanh",
    address: "Đường Nguyễn Chí Thanh, Quận Đống Đa, Hà Nội",
    ward: "Phường Láng Thượng",
    district: "Quận Đống Đa",
    lat: 21.021,
    lng: 105.8085,
    aliases: ["nguyen chi thanh", "duong nguyen chi thanh"],
  },
  {
    id: "loc_huynh_thuc_khang",
    name: "Đường Huỳnh Thúc Kháng",
    address: "Đường Huỳnh Thúc Kháng, Phường Láng Hạ, Quận Đống Đa, Hà Nội",
    ward: "Phường Láng Hạ",
    district: "Quận Đống Đa",
    lat: 21.019,
    lng: 105.812,
    aliases: ["huynh thuc khang", "duong huynh thuc khang"],
  },
  {
    id: "loc_lang_ha",
    name: "Đường Láng Hạ",
    address: "Đường Láng Hạ, Phường Láng Hạ, Quận Đống Đa, Hà Nội",
    ward: "Phường Láng Hạ",
    district: "Quận Đống Đa",
    lat: 21.017,
    lng: 105.817,
    aliases: ["lang ha", "duong lang ha"],
  },
  {
    id: "loc_thai_ha",
    name: "Đường Thái Hà",
    address: "Đường Thái Hà, Phường Trung Liệt, Quận Đống Đa, Hà Nội",
    ward: "Phường Trung Liệt",
    district: "Quận Đống Đa",
    lat: 21.013,
    lng: 105.82,
    aliases: ["thai ha", "duong thai ha"],
  },
  {
    id: "loc_chua_boc",
    name: "Đường Chùa Bộc",
    address: "Đường Chùa Bộc, Phường Quang Trung, Quận Đống Đa, Hà Nội",
    ward: "Phường Quang Trung",
    district: "Quận Đống Đa",
    lat: 21.008,
    lng: 105.8285,
    aliases: ["chua boc", "duong chua boc", "hoc vien ngan hang"],
  },
  {
    id: "loc_tay_son",
    name: "Đường Tây Sơn",
    address: "Đường Tây Sơn, Quận Đống Đa, Hà Nội",
    ward: "Phường Quang Trung",
    district: "Quận Đống Đa",
    lat: 21.009,
    lng: 105.823,
    aliases: ["tay son", "duong tay son", "nga tu so", "dai hoc thuy loi"],
  },
  {
    id: "loc_xa_dan",
    name: "Đường Xã Đàn",
    address: "Đường Xã Đàn, Phường Nam Đồng, Quận Đống Đa, Hà Nội",
    ward: "Phường Nam Đồng",
    district: "Quận Đống Đa",
    lat: 21.0145,
    lng: 105.834,
    aliases: ["xa dan", "duong xa dan", "o cho dua"],
  },
  {
    id: "loc_hoang_cau",
    name: "Đường Hoàng Cầu",
    address: "Đường Hoàng Cầu, Phường Ô Chợ Dừa, Quận Đống Đa, Hà Nội",
    ward: "Phường Ô Chợ Dừa",
    district: "Quận Đống Đa",
    lat: 21.018,
    lng: 105.822,
    aliases: ["hoang cau", "duong hoang cau"],
  },
  {
    id: "loc_ton_duc_thang",
    name: "Đường Tôn Đức Thắng",
    address: "Đường Tôn Đức Thắng, Phường Quốc Tử Giám, Quận Đống Đa, Hà Nội",
    ward: "Phường Quốc Tử Giám",
    district: "Quận Đống Đa",
    lat: 21.025,
    lng: 105.833,
    aliases: ["ton duc thang", "van mieu"],
  },

  // Khu vực Cầu Giấy
  {
    id: "loc_duong_cau_giay",
    name: "Đường Cầu Giấy",
    address: "Đường Cầu Giấy, Phường Dịch Vọng, Quận Cầu Giấy, Hà Nội",
    ward: "Phường Dịch Vọng",
    district: "Quận Cầu Giấy",
    lat: 21.033,
    lng: 105.799,
    aliases: ["cau giay", "duong cau giay", "quan cau giay"],
  },
  {
    id: "loc_xuan_thuy",
    name: "Đường Xuân Thủy",
    address: "Đường Xuân Thủy, Phường Dịch Vọng Hậu, Quận Cầu Giấy, Hà Nội",
    ward: "Phường Dịch Vọng Hậu",
    district: "Quận Cầu Giấy",
    lat: 21.0365,
    lng: 105.786,
    aliases: ["xuan thuy", "duong xuan thuy", "dai hoc su pham", "dai hoc quoc gia"],
  },
  {
    id: "loc_duy_tan",
    name: "Phố Duy Tân",
    address: "Phố Duy Tân, Phường Dịch Vọng Hậu, Quận Cầu Giấy, Hà Nội",
    ward: "Phường Dịch Vọng Hậu",
    district: "Quận Cầu Giấy",
    lat: 21.031,
    lng: 105.783,
    aliases: ["duy tan", "pho duy tan", "toa nha fpt", "cmc tower"],
  },
  {
    id: "loc_tran_thai_tong",
    name: "Đường Trần Thái Tông",
    address: "Đường Trần Thái Tông, Phường Dịch Vọng Hậu, Quận Cầu Giấy, Hà Nội",
    ward: "Phường Dịch Vọng Hậu",
    district: "Quận Cầu Giấy",
    lat: 21.03,
    lng: 105.787,
    aliases: ["tran thai tong", "duong tran thai tong"],
  },
  {
    id: "loc_tran_duy_hung",
    name: "Đường Trần Duy Hưng",
    address: "Đường Trần Duy Hưng, Phường Trung Hòa, Quận Cầu Giấy, Hà Nội",
    ward: "Phường Trung Hòa",
    district: "Quận Cầu Giấy",
    lat: 21.009,
    lng: 105.798,
    aliases: ["tran duy hung", "duong tran duy hung", "trung hoa"],
  },
  {
    id: "loc_hoang_quoc_viet",
    name: "Đường Hoàng Quốc Việt",
    address: "Đường Hoàng Quốc Việt, Phường Nghĩa Đô, Quận Cầu Giấy, Hà Nội",
    ward: "Phường Nghĩa Đô",
    district: "Quận Cầu Giấy",
    lat: 21.045,
    lng: 105.792,
    aliases: ["hoang quoc viet", "duong hoang quoc viet"],
  },
  {
    id: "loc_nguyen_khang",
    name: "Đường Nguyễn Khang",
    address: "Đường Nguyễn Khang, Phường Yên Hòa, Quận Cầu Giấy, Hà Nội",
    ward: "Phường Yên Hòa",
    district: "Quận Cầu Giấy",
    lat: 21.018,
    lng: 105.801,
    aliases: ["nguyen khang", "duong nguyen khang"],
  },
  {
    id: "loc_trung_kinh",
    name: "Đường Trung Kính",
    address: "Đường Trung Kính, Phường Yên Hòa, Quận Cầu Giấy, Hà Nội",
    ward: "Phường Yên Hòa",
    district: "Quận Cầu Giấy",
    lat: 21.017,
    lng: 105.793,
    aliases: ["trung kinh", "duong trung kinh"],
  },
  {
    id: "loc_discovery_complex",
    name: "Tòa Discovery Complex - 302 Cầu Giấy",
    address: "302 Cầu Giấy, Phường Dịch Vọng, Quận Cầu Giấy, Hà Nội",
    ward: "Phường Dịch Vọng",
    district: "Quận Cầu Giấy",
    lat: 21.035,
    lng: 105.795,
    aliases: ["discovery complex", "302 cau giay"],
  },

  // Khu vực Ba Đình
  {
    id: "loc_lotte_center",
    name: "Lotte Center Hà Nội - 54 Liễu Giai",
    address: "54 Liễu Giai, Phường Cống Vị, Quận Ba Đình, Hà Nội",
    ward: "Phường Cống Vị",
    district: "Quận Ba Đình",
    lat: 21.0325,
    lng: 105.8125,
    aliases: ["lotte", "lotte center", "54 lieu giai", "lotte ha noi"],
  },
  {
    id: "loc_vincom_metropolis",
    name: "Vincom Center Metropolis - 29 Liễu Giai",
    address: "29 Liễu Giai, Phường Ngọc Khánh, Quận Ba Đình, Hà Nội",
    ward: "Phường Ngọc Khánh",
    district: "Quận Ba Đình",
    lat: 21.0315,
    lng: 105.8135,
    aliases: ["metropolis", "vincom metropolis", "29 lieu giai"],
  },
  {
    id: "loc_kim_ma",
    name: "Đường Kim Mã",
    address: "Đường Kim Mã, Quận Ba Đình, Hà Nội",
    ward: "Phường Kim Mã",
    district: "Quận Ba Đình",
    lat: 21.031,
    lng: 105.822,
    aliases: ["kim ma", "duong kim ma"],
  },
  {
    id: "loc_doi_can",
    name: "Đường Đội Cấn",
    address: "Đường Đội Cấn, Quận Ba Đình, Hà Nội",
    ward: "Phường Đội Cấn",
    district: "Quận Ba Đình",
    lat: 21.035,
    lng: 105.82,
    aliases: ["doi can", "duong doi can"],
  },
  {
    id: "loc_giang_vo",
    name: "Đường Giảng Võ",
    address: "Đường Giảng Võ, Phường Giảng Võ, Quận Ba Đình, Hà Nội",
    ward: "Phường Giảng Võ",
    district: "Quận Ba Đình",
    lat: 21.026,
    lng: 105.821,
    aliases: ["giang vo", "duong giang vo"],
  },

  // Khu vực Thanh Xuân
  {
    id: "loc_royal_city",
    name: "Vinhomes Royal City - 72A Nguyễn Trãi",
    address: "72A Nguyễn Trãi, Phường Thượng Đình, Quận Thanh Xuân, Hà Nội",
    ward: "Phường Thượng Đình",
    district: "Quận Thanh Xuân",
    lat: 21.002,
    lng: 105.816,
    aliases: ["royal city", "vinhomes royal city", "72a nguyen trai"],
  },
  {
    id: "loc_le_van_luong",
    name: "Đường Lê Văn Lương",
    address: "Đường Lê Văn Lương, Phường Nhân Chính, Quận Thanh Xuân, Hà Nội",
    ward: "Phường Nhân Chính",
    district: "Quận Thanh Xuân",
    lat: 21.004,
    lng: 105.803,
    aliases: ["le van luong", "duong le van luong"],
  },
  {
    id: "loc_hoang_dao_thuy",
    name: "Đường Hoàng Đạo Thúy",
    address: "Đường Hoàng Đạo Thúy, Phường Nhân Chính, Quận Thanh Xuân, Hà Nội",
    ward: "Phường Nhân Chính",
    district: "Quận Thanh Xuân",
    lat: 21.007,
    lng: 105.802,
    aliases: ["hoang dao thuy", "trung hoa nhan chinh"],
  },
  {
    id: "loc_nguyen_trai",
    name: "Đường Nguyễn Trãi",
    address: "Đường Nguyễn Trãi, Quận Thanh Xuân, Hà Nội",
    ward: "Phường Thanh Xuân Trung",
    district: "Quận Thanh Xuân",
    lat: 20.996,
    lng: 105.809,
    aliases: ["nguyen trai", "duong nguyen trai"],
  },
  {
    id: "loc_khuat_duy_tien",
    name: "Đường Khuất Duy Tiến",
    address: "Đường Khuất Duy Tiến, Phường Thanh Xuân Bắc, Quận Thanh Xuân, Hà Nội",
    ward: "Phường Thanh Xuân Bắc",
    district: "Quận Thanh Xuân",
    lat: 20.998,
    lng: 105.793,
    aliases: ["khuat duy tien", "duong khuat duy tien"],
  },

  // Khu vực Nam Từ Liêm
  {
    id: "loc_keangnam",
    name: "Tòa nhà Keangnam Hanoi Landmark 72",
    address: "Đường Phạm Hùng, Phường Mễ Trì, Quận Nam Từ Liêm, Hà Nội",
    ward: "Phường Mễ Trì",
    district: "Quận Nam Từ Liêm",
    lat: 21.0165,
    lng: 105.784,
    aliases: ["keangnam", "landmark 72", "keangnam hanoi"],
  },
  {
    id: "loc_the_manor",
    name: "The Manor Hà Nội",
    address: "Đường Mễ Trì, Phường Mễ Trì, Quận Nam Từ Liêm, Hà Nội",
    ward: "Phường Mễ Trì",
    district: "Quận Nam Từ Liêm",
    lat: 21.0135,
    lng: 105.779,
    aliases: ["the manor", "me tri"],
  },
  {
    id: "loc_pham_hung",
    name: "Đường Phạm Hùng",
    address: "Đường Phạm Hùng, Quận Nam Từ Liêm, Hà Nội",
    ward: "Phường Mễ Trì",
    district: "Quận Nam Từ Liêm",
    lat: 21.02,
    lng: 105.78,
    aliases: ["pham hung", "duong pham hung", "ben xe my dinh"],
  },
  {
    id: "loc_my_dinh",
    name: "Khu đô thị Mỹ Đình - Đường Lê Đức Thọ",
    address: "Đường Lê Đức Thọ, Phường Mỹ Đình 1, Quận Nam Từ Liêm, Hà Nội",
    ward: "Phường Mỹ Đình 1",
    district: "Quận Nam Từ Liêm",
    lat: 21.03,
    lng: 105.768,
    aliases: ["my dinh", "san van dong my dinh", "le duc tho"],
  },
  {
    id: "loc_smart_city",
    name: "Khu đô thị Vinhomes Smart City",
    address: "Tây Mỗ, Quận Nam Từ Liêm, Hà Nội",
    ward: "Phường Tây Mỗ",
    district: "Quận Nam Từ Liêm",
    lat: 20.999,
    lng: 105.743,
    aliases: ["smart city", "vinhomes smart city", "tay mo"],
  },

  // Khu vực Hoàn Kiếm
  {
    id: "loc_ho_hoan_kiem",
    name: "Hồ Hoàn Kiếm (Hồ Gươm)",
    address: "Đinh Tiên Hoàng, Phường Hàng Trống, Quận Hoàn Kiếm, Hà Nội",
    ward: "Phường Hàng Trống",
    district: "Quận Hoàn Kiếm",
    lat: 21.028511,
    lng: 105.854444,
    aliases: ["ho guom", "ho hoan kiem", "hoan kiem", "trang tien"],
  },
  {
    id: "loc_trang_thi",
    name: "Phố Tràng Thi",
    address: "Phố Tràng Thi, Phường Hàng Trống, Quận Hoàn Kiếm, Hà Nội",
    ward: "Phường Hàng Trống",
    district: "Quận Hoàn Kiếm",
    lat: 21.028,
    lng: 105.849,
    aliases: ["trang thi", "pho trang thi", "bv viet duc"],
  },

  // Khu vực Hai Bà Trưng
  {
    id: "loc_bach_khoa",
    name: "Đại học Bách Khoa Hà Nội - 1 Đại Cồ Việt",
    address: "1 Đại Cồ Việt, Phường Bách Khoa, Quận Hai Bà Trưng, Hà Nội",
    ward: "Phường Bách Khoa",
    district: "Quận Hai Bà Trưng",
    lat: 21.005,
    lng: 105.843,
    aliases: ["bach khoa", "dh bach khoa", "dai hoc bach khoa", "dai co viet"],
  },
  {
    id: "loc_kinh_te_quoc_dan",
    name: "Đại học Kinh Tế Quốc Dân (NEU) - 207 Giải Phóng",
    address: "207 Giải Phóng, Phường Đồng Tâm, Quận Hai Bà Trưng, Hà Nội",
    ward: "Phường Đồng Tâm",
    district: "Quận Hai Bà Trưng",
    lat: 20.9995,
    lng: 105.842,
    aliases: ["neu", "kinh te quoc dan", "207 giai phong"],
  },
  {
    id: "loc_times_city",
    name: "Vinhomes Times City - 458 Minh Khai",
    address: "458 Minh Khai, Phường Vĩnh Tuy, Quận Hai Bà Trưng, Hà Nội",
    ward: "Phường Vĩnh Tuy",
    district: "Quận Hai Bà Trưng",
    lat: 20.996,
    lng: 105.867,
    aliases: ["times city", "vinhomes times city", "458 minh khai"],
  },

  // Khu vực Tây Hồ
  {
    id: "loc_lotte_west_lake",
    name: "Lotte Mall West Lake - 272 Võ Chí Công",
    address: "272 Võ Chí Công, Phường Phú Thượng, Quận Tây Hồ, Hà Nội",
    ward: "Phường Phú Thượng",
    district: "Quận Tây Hồ",
    lat: 21.074,
    lng: 105.813,
    aliases: ["lotte tay ho", "lotte mall west lake", "vo chi cong"],
  },
  {
    id: "loc_ho_tay",
    name: "Hồ Tây - Đường Lạc Long Quân",
    address: "Đường Lạc Long Quân, Phường Bưởi, Quận Tây Hồ, Hà Nội",
    ward: "Phường Bưởi",
    district: "Quận Tây Hồ",
    lat: 21.055,
    lng: 105.811,
    aliases: ["ho tay", "lac long quan", "thuy khue"],
  },

  // Khu vực Hà Đông
  {
    id: "loc_aeon_ha_dong",
    name: "Aeon Mall Hà Đông",
    address: "Khu đô thị Dương Nội, Phường Dương Nội, Quận Hà Đông, Hà Nội",
    ward: "Phường Dương Nội",
    district: "Quận Hà Đông",
    lat: 20.978,
    lng: 105.753,
    aliases: ["aeon ha dong", "aeon mall ha dong", "duong noi"],
  },
  {
    id: "loc_quang_trung_ha_dong",
    name: "Đường Quang Trung, Hà Đông",
    address: "Đường Quang Trung, Quận Hà Đông, Hà Nội",
    ward: "Phường Quang Trung",
    district: "Quận Hà Đông",
    lat: 20.97,
    lng: 105.772,
    aliases: ["quang trung ha dong", "ha dong", "tran phu ha dong"],
  },

  // Khu vực Long Biên
  {
    id: "loc_aeon_long_bien",
    name: "Aeon Mall Long Biên - 27 Cổ Linh",
    address: "27 Cổ Linh, Phường Long Biên, Quận Long Biên, Hà Nội",
    ward: "Phường Long Biên",
    district: "Quận Long Biên",
    lat: 21.026,
    lng: 105.899,
    aliases: ["aeon long bien", "aeon mall long bien", "co linh"],
  },
  {
    id: "loc_nguyen_van_cu",
    name: "Đường Nguyễn Văn Cừ, Long Biên",
    address: "Đường Nguyễn Văn Cừ, Phường Ngọc Lâm, Quận Long Biên, Hà Nội",
    ward: "Phường Ngọc Lâm",
    district: "Quận Long Biên",
    lat: 21.045,
    lng: 105.875,
    aliases: ["nguyen van cu", "long bien", "ngoc lam"],
  },
];

// Khởi tạo các điểm đã biết vào knownPlaces
for (const pt of HANOI_DIRECTORY) {
  knownPlaces.set(pt.id, {
    lat: pt.lat,
    lng: pt.lng,
    formattedAddress: pt.address,
  });
}

/**
 * Tìm kiếm gợi ý địa chỉ từ dữ liệu cục bộ Hà Nội
 */
export function searchLocalHanoiLocations(input: string): AutoCompletePrediction[] {
  const clean = input.trim();
  if (clean.length < 2) return [];

  const normalizedInput = normalizeVietnamese(clean);

  // Tách số nhà (nếu có ở đầu chuỗi, ví dụ "123 Cầu Giấy" hoặc "Ngõ 84 Chùa Láng")
  const houseNoMatch = clean.match(/^(\d+|ngõ\s+\d+|số\s+\d+)\s*(.*)$/i);
  const housePrefix = houseNoMatch ? houseNoMatch[1].trim() : "";
  const remainingQuery = houseNoMatch && houseNoMatch[2] ? normalizeVietnamese(houseNoMatch[2]) : "";

  const results: AutoCompletePrediction[] = [];

  for (const pt of HANOI_DIRECTORY) {
    const normName = normalizeVietnamese(pt.name);
    const normAddr = normalizeVietnamese(pt.address);

    const matchesAlias = pt.aliases.some((alias) => {
      const normAlias = normalizeVietnamese(alias);
      return (
        normalizedInput.includes(normAlias) ||
        normAlias.includes(normalizedInput) ||
        (remainingQuery.length >= 2 && normAlias.includes(remainingQuery))
      );
    });

    const matchesName = normName.includes(normalizedInput);
    const matchesAddr = normAddr.includes(normalizedInput);

    if (matchesAlias || matchesName || matchesAddr) {
      // Nếu khách gõ kèm số nhà/ngõ, tạo bản ghi tùy biến phù hợp
      if (housePrefix && !normName.startsWith(normalizeVietnamese(housePrefix))) {
        const customId = `local_${pt.id}_${encodeURIComponent(housePrefix)}`;
        const customMain = `${housePrefix} ${pt.name}`;
        const customDesc = `${housePrefix} ${pt.address}`;

        knownPlaces.set(customId, {
          lat: pt.lat,
          lng: pt.lng,
          formattedAddress: customDesc,
        });

        results.push({
          place_id: customId,
          description: customDesc,
          main_text: customMain,
          secondary_text: `${pt.ward}, ${pt.district}, Hà Nội`,
          lat: pt.lat,
          lng: pt.lng,
        });
      } else {
        const fullDesc = pt.address.includes(pt.name) ? pt.address : `${pt.name}, ${pt.address}`;
        results.push({
          place_id: pt.id,
          description: fullDesc,
          main_text: pt.name,
          secondary_text: `${pt.ward}, ${pt.district}, Hà Nội`,
          lat: pt.lat,
          lng: pt.lng,
        });
      }
    }

    if (results.length >= 8) break;
  }

  return results;
}

/**
 * Gọi OpenStreetMap Nominatim Vietnam như một fallback trực tuyến tự động
 */
async function searchNominatimHanoi(query: string): Promise<AutoCompletePrediction[]> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 1800);

    const endpoint = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(
      query + " Hà Nội"
    )}&format=json&addressdetails=1&limit=5&countrycodes=vn`;

    const res = await fetch(endpoint, {
      signal: controller.signal,
      headers: { "User-Agent": "MoHopLaNha-HealthyFood/1.0" },
    });
    clearTimeout(timeoutId);

    if (!res.ok) return [];

    const data = await res.json();
    if (!Array.isArray(data)) return [];

    const predictions: AutoCompletePrediction[] = [];
    for (const item of data) {
      const osmId = `osm_${item.place_id || item.osm_id}`;
      const lat = Number(item.lat);
      const lng = Number(item.lon);
      const display = String(item.display_name || "");
      const addrObj = item.address || {};
      const road = addrObj.road || addrObj.suburb || addrObj.neighbourhood || item.name || query;
      const district = addrObj.city_district || addrObj.county || "Hà Nội";

      knownPlaces.set(osmId, {
        lat,
        lng,
        formattedAddress: display,
      });

      predictions.push({
        place_id: osmId,
        description: display,
        main_text: road,
        secondary_text: district,
        lat,
        lng,
      });
    }

    return predictions;
  } catch {
    return [];
  }
}

/**
 * Gọi Goong Place AutoComplete API kết hợp bộ dự phòng thông minh Hà Nội
 */
export async function fetchGoongAutoComplete(
  input: string,
  config = getGoongConfig()
): Promise<AutoCompletePrediction[]> {
  const trimmed = input.trim();
  if (trimmed.length < 2) return [];

  // 1. Thử gọi Goong API trước nếu có API Key
  if (config.apiKey) {
    const endpoint = `https://rsapi.goong.io/v2/place/autocomplete?input=${encodeURIComponent(
      trimmed
    )}&location=${config.storeLat},${config.storeLng}&radius=${config.maxDistanceM}&limit=8&more_compound=true&api_key=${config.apiKey}`;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3500);

      const res = await fetch(endpoint, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        if (data.status === "OK" && Array.isArray(data.predictions) && data.predictions.length > 0) {
          return data.predictions.map((p: Record<string, unknown>) => {
            const sf = (p.structured_formatting as Record<string, string>) || {};
            return {
              place_id: String(p.place_id || ""),
              description: String(p.description || ""),
              main_text: String(sf.main_text || p.description || ""),
              secondary_text: String(sf.secondary_text || ""),
            };
          });
        }
      }
    } catch (err) {
      console.warn("[Goong AutoComplete] Thử Goong không thành công, chuyển sang bộ dự phòng:", err);
    }
  }

  // 2. Dự phòng: Tìm kiếm trong danh mục Hà Nội phong phú
  const localResults = searchLocalHanoiLocations(trimmed);
  if (localResults.length > 0) {
    return localResults;
  }

  // 3. Dự phòng 2: Gọi OpenStreetMap Nominatim
  const osmResults = await searchNominatimHanoi(trimmed);
  if (osmResults.length > 0) {
    return osmResults;
  }

  // 4. Nếu không khớp bất kỳ điểm nào, tạo gợi ý định dạng tiêu chuẩn theo chuỗi nhập
  const fallbackId = `custom_${Date.now()}`;
  const customPrediction: AutoCompletePrediction = {
    place_id: fallbackId,
    description: `${trimmed}, Hà Nội`,
    main_text: trimmed,
    secondary_text: "Hà Nội (bán kính 20km từ 91 Chùa Láng)",
    lat: config.storeLat,
    lng: config.storeLng,
  };

  knownPlaces.set(fallbackId, {
    lat: config.storeLat,
    lng: config.storeLng,
    formattedAddress: `${trimmed}, Hà Nội`,
  });

  return [customPrediction];
}

/**
 * Gọi Goong Place Detail API để lấy tọa độ lat/lng từ place_id
 */
export async function fetchGoongPlaceDetail(
  placeId: string,
  config = getGoongConfig()
): Promise<{ lat: number; lng: number; formattedAddress: string } | null> {
  if (!placeId) return null;

  // Kiểm tra bộ nhớ đệm knownPlaces trước
  const cachedPlace = knownPlaces.get(placeId);
  if (cachedPlace) {
    return cachedPlace;
  }

  if (!config.apiKey) {
    return null;
  }

  const endpoint = `https://rsapi.goong.io/v2/place/detail?place_id=${encodeURIComponent(
    placeId
  )}&api_key=${config.apiKey}`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);

    const res = await fetch(endpoint, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!res.ok) {
      console.warn(`[Goong Place Detail] Lỗi HTTP ${res.status}`);
      return null;
    }

    const data = await res.json();
    if (data.status !== "OK" || !data.result) return null;

    const loc = data.result.geometry?.location;
    if (!loc || typeof loc.lat !== "number" || typeof loc.lng !== "number") {
      return null;
    }

    const resolved = {
      lat: loc.lat,
      lng: loc.lng,
      formattedAddress: data.result.formatted_address || "",
    };

    knownPlaces.set(placeId, resolved);
    return resolved;
  } catch (err) {
    console.warn("[Goong Place Detail Exception]", err);
    return null;
  }
}

/**
 * Gọi Goong Distance Matrix API
 */
export async function fetchGoongDistanceMatrix(
  origin: { lat: number; lng: number },
  destination: { lat: number; lng: number },
  vehicle: string = "bike",
  apiKey: string = getGoongConfig().apiKey
): Promise<{ distance_m: number; duration_s: number } | null> {
  if (!apiKey) return null;

  const endpoint = `https://rsapi.goong.io/v2/distancematrix?origins=${origin.lat},${origin.lng}&destinations=${destination.lat},${destination.lng}&vehicle=${vehicle}&api_key=${apiKey}`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const res = await fetch(endpoint, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!res.ok) {
      console.warn(`[Goong DistanceMatrix] Lỗi HTTP ${res.status}`);
      return null;
    }

    const data = await res.json();
    if (data.status !== "OK" || !Array.isArray(data.rows) || !data.rows[0]) {
      return null;
    }

    const elem = data.rows[0].elements?.[0];
    if (!elem || elem.status !== "OK") {
      return null;
    }

    return {
      distance_m: Number(elem.distance?.value || 0),
      duration_s: Number(elem.duration?.value || 0),
    };
  } catch (err) {
    console.warn("[Goong DistanceMatrix Exception]", err);
    return null;
  }
}

/**
 * Kiểm tra phạm vi giao hàng 20km theo quy trình chặt chẽ & tự động fallback
 */
export async function checkDeliveryDistance(params: {
  placeId?: string;
  lat?: number;
  lng?: number;
  address?: string;
  config?: GoongConfig;
}): Promise<DeliveryCheckResult> {
  const config = params.config || getGoongConfig();

  // Kiểm tra cache theo placeId
  if (params.placeId) {
    const cached = checkCache.get(params.placeId);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      return cached.result;
    }
  }

  let destLat = params.lat;
  let destLng = params.lng;
  let formattedAddress = params.address || "";

  // Bước 2: Chi tiết địa điểm nếu có place_id mà chưa có tọa độ
  if (params.placeId && (destLat === undefined || destLng === undefined)) {
    const detail = await fetchGoongPlaceDetail(params.placeId, config);
    if (detail) {
      destLat = detail.lat;
      destLng = detail.lng;
      if (!formattedAddress) formattedAddress = detail.formattedAddress;
    }
  }

  // Nếu vẫn chưa có tọa độ và có address text: thử đối chiếu trong knownPlaces hoặc local dataset
  if ((destLat === undefined || destLng === undefined) && formattedAddress) {
    const matchedLocal = searchLocalHanoiLocations(formattedAddress);
    if (matchedLocal.length > 0 && matchedLocal[0].lat && matchedLocal[0].lng) {
      destLat = matchedLocal[0].lat;
      destLng = matchedLocal[0].lng;
    }
  }

  // Nếu không có tọa độ nhưng có địa chỉ: kiểm tra qua validateServiceArea
  if (destLat === undefined || destLng === undefined) {
    if (formattedAddress) {
      const areaCheck = validateServiceArea(formattedAddress);
      if (areaCheck.inService) {
        // Địa chỉ hợp lệ thuộc Hà Nội, cho phép giao hàng với khoảng cách ước tính
        const result: DeliveryCheckResult = {
          deliverable: true,
          distance_m: 3500,
          duration_s: 600,
          reason: `Địa chỉ trong khu vực ${areaCheck.matchedDistrict || "Hà Nội"} (bán kính 20km từ 91 Chùa Láng).`,
          approximate: true,
          formattedAddress,
        };
        if (params.placeId) {
          checkCache.set(params.placeId, { result, timestamp: Date.now() });
        }
        return result;
      } else {
        return {
          deliverable: false,
          distance_m: 0,
          duration_s: 0,
          reason:
            areaCheck.message ||
            "Địa chỉ nằm ngoài vùng phục vụ. Mở Hộp Là Nhà hiện chỉ phục vụ trong bán kính 20km từ 91 Chùa Láng, Đống Đa, Hà Nội.",
          approximate: false,
        };
      }
    }

    return {
      deliverable: false,
      distance_m: 0,
      duration_s: 0,
      reason: "Không thể xác định tọa độ địa chỉ nhận hàng.",
      approximate: false,
    };
  }

  // Bước 3: Lọc sơ bộ (không tốn quota) bằng khoảng cách Haversine
  const haversineDist = haversineDistanceMeters(
    config.storeLat,
    config.storeLng,
    destLat,
    destLng
  );

  if (haversineDist > config.maxDistanceM) {
    const result: DeliveryCheckResult = {
      deliverable: false,
      distance_m: haversineDist,
      duration_s: 0,
      reason: `Địa chỉ nằm ngoài phạm vi giao hàng, vượt quá bán kính phục vụ 20km của cửa hàng (khoảng cách đường chim bay: ${(
        haversineDist / 1000
      ).toFixed(1)}km).`,
      approximate: false,
      lat: destLat,
      lng: destLng,
      formattedAddress,
    };
    if (params.placeId) {
      checkCache.set(params.placeId, { result, timestamp: Date.now() });
    }
    return result;
  }

  // Bước 4: Tính khoảng cách di chuyển thực tế qua Goong Distance Matrix (nếu có key)
  let matrixResult: { distance_m: number; duration_s: number } | null = null;
  if (config.apiKey) {
    matrixResult = await fetchGoongDistanceMatrix(
      { lat: config.storeLat, lng: config.storeLng },
      { lat: destLat, lng: destLng },
      config.vehicle,
      config.apiKey
    );
  }

  // Bước 5: Quyết định dựa trên kết quả Distance Matrix hoặc Fallback
  let result: DeliveryCheckResult;

  if (matrixResult) {
    const realDist = matrixResult.distance_m;
    const realDuration = matrixResult.duration_s;
    const deliverable = realDist <= config.maxDistanceM;

    result = {
      deliverable,
      distance_m: realDist,
      duration_s: realDuration,
      reason: deliverable
        ? `Nằm trong phạm vi giao hàng (${(realDist / 1000).toFixed(1)}km, khoảng ${Math.round(
            realDuration / 60
          )} phút di chuyển).`
        : `Khoảng cách tuyến đường thực tế (${(realDist / 1000).toFixed(
            1
          )}km) vượt quá phạm vi giao hàng 20km.`,
      approximate: false,
      lat: destLat,
      lng: destLng,
      formattedAddress,
    };
  } else {
    // Xử lý lỗi / Fallback khi Goong timeout/429/hết quota/chưa có key:
    // Dùng khoảng cách Haversine kèm cờ "approximate: true", KHÔNG chặn đặt hàng im lặng
    const deliverable = haversineDist <= config.maxDistanceM;
    const estimatedDuration = Math.round(haversineDist / 6.94); // Tốc độ xe máy ~25km/h

    result = {
      deliverable,
      distance_m: haversineDist,
      duration_s: estimatedDuration,
      reason: deliverable
        ? `Khoảng cách ước tính ${(haversineDist / 1000).toFixed(
            1
          )}km nằm trong phạm vi giao hàng (chế độ dự phòng).`
        : `Khoảng cách ước tính ${(haversineDist / 1000).toFixed(
            1
          )}km vượt quá bán kính phục vụ 20km (chế độ dự phòng).`,
      approximate: true,
      lat: destLat,
      lng: destLng,
      formattedAddress,
    };
  }

  if (params.placeId) {
    checkCache.set(params.placeId, { result, timestamp: Date.now() });
  }

  return result;
}
