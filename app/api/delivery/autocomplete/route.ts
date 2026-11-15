import { NextResponse } from "next/server";
import { getClientIp, limit, rateLimitResponse } from "@/lib/ratelimit";
import { fetchGoongAutoComplete } from "@/lib/goong";

export async function GET(request: Request) {
  try {
    const clientIp = getClientIp(request);
    const ipCheck = await limit("delivery_autocomplete", clientIp);
    if (!ipCheck.ok) {
      return rateLimitResponse(
        ipCheck.retryAfter,
        `Yêu cầu gợi ý địa chỉ quá nhanh. Vui lòng thử lại sau ${ipCheck.retryAfter} giây.`
      );
    }

    const { searchParams } = new URL(request.url);
    const input = (searchParams.get("input") || searchParams.get("q") || "").trim();

    if (input.length < 2) {
      return NextResponse.json({ predictions: [] });
    }

    const predictions = await fetchGoongAutoComplete(input);
    return NextResponse.json({ predictions });
  } catch (error) {
    console.error("[Delivery Autocomplete Error]", error);
    return NextResponse.json({ predictions: [] });
  }
}
