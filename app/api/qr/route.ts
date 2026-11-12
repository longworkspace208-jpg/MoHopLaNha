import QRCode from "qrcode";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const data = new URL(request.url).searchParams.get("data");
  if (!data || data.length > 1000) {
    return new NextResponse("Dữ liệu QR không hợp lệ", { status: 400 });
  }

  try {
    const svg = await QRCode.toString(data, {
      type: "svg",
      margin: 1,
      errorCorrectionLevel: "M"
    });
    return new NextResponse(svg, {
      headers: {
        "Content-Type": "image/svg+xml",
        "Cache-Control": "public, max-age=3600"
      }
    });
  } catch {
    return new NextResponse("Không thể tạo mã QR", { status: 500 });
  }
}
