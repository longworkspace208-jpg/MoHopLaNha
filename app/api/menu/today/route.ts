import { NextResponse } from "next/server";
import { getCachedTodayMenu, todayInVietnam } from "@/lib/menu-cache";

export async function GET() {
  const menuDate = todayInVietnam();
  const data = await getCachedTodayMenu(menuDate);

  return NextResponse.json(data, {
    headers: {
      "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
