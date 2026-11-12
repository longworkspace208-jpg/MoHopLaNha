export const BANK_CONFIG = {
  bin: process.env.BANK_BIN || "970422", // Mặc định MBBank
  account: process.env.BANK_ACCOUNT || "0357787937",
  accountName: process.env.BANK_ACCOUNT_NAME || "MO HOP LA NHA",
  bankName: "MBBank (Ngân hàng TMCP Quân đội)"
};

/**
 * Tạo URL ảnh VietQR qua dịch vụ công khai VietQR.io
 * @param amount Số tiền VND
 * @param memo Nội dung chuyển khoản (thường là mã đơn MHLN####)
 */
export function getVietQrImageUrl(amount: number, memo: string): string {
  const bin = BANK_CONFIG.bin;
  const account = BANK_CONFIG.account;
  const accountName = encodeURIComponent(BANK_CONFIG.accountName);
  const addInfo = encodeURIComponent(memo);
  return `https://img.vietqr.io/image/${bin}-${account}-compact2.png?amount=${amount}&addInfo=${addInfo}&accountName=${accountName}`;
}

/**
 * Tính mã kiểm tra CRC-16 (CCITT-FALSE) chuẩn EMVCo
 */
function crc16(data: string): string {
  let crc = 0xffff;
  for (let i = 0; i < data.length; i++) {
    crc ^= data.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      if ((crc & 0x8000) !== 0) {
        crc = ((crc << 1) ^ 0x1021) & 0xffff;
      } else {
        crc = (crc << 1) & 0xffff;
      }
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

function tlv(id: string, value: string): string {
  const len = value.length.toString().padStart(2, "0");
  return `${id}${len}${value}`;
}

/**
 * Tạo chuỗi QR theo chuẩn VietQR / EMVCo để render trực tiếp bằng thư viện qrcode
 */
export function generateVietQrPayload(amount: number, memo: string): string {
  // 00: Version (01)
  const f00 = tlv("00", "01");
  // 01: Initiation method (12 = Dynamic QR với số tiền cụ thể, 11 = Static)
  const f01 = tlv("01", "12");

  // 38: Consumer Account Information (VietQR template)
  // GUID: A000000727
  const g00 = tlv("00", "A000000727");
  // Beneficiary org: BIN (00) + Account (01)
  const b00 = tlv("00", BANK_CONFIG.bin);
  const b01 = tlv("01", BANK_CONFIG.account);
  const g01 = tlv("01", `${b00}${b01}`);
  // Service code (QRIBFTTA: chuyển tiền nhanh Napas 247 tới tài khoản)
  const g02 = tlv("02", "QRIBFTTA");
  const f38 = tlv("38", `${g00}${g01}${g02}`);

  // 53: Transaction Currency (704 = VND)
  const f53 = tlv("53", "704");
  // 54: Transaction Amount
  const f54 = tlv("54", Math.round(amount).toString());
  // 58: Country Code
  const f58 = tlv("58", "VN");
  // 62: Additional Data Field (08: Purpose of transaction / nội dung CK)
  const addData08 = tlv("08", memo);
  const f62 = tlv("62", addData08);

  const raw = `${f00}${f01}${f38}${f53}${f54}${f58}${f62}6304`;
  const crc = crc16(raw);
  return `${raw}${crc}`;
}

