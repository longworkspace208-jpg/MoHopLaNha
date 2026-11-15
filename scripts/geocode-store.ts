import fs from "fs";

if (fs.existsSync(".env.local")) {
  const content = fs.readFileSync(".env.local", "utf8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith("#") && trimmed.includes("=")) {
      const idx = trimmed.indexOf("=");
      const key = trimmed.slice(0, idx).trim();
      const val = trimmed.slice(idx + 1).trim();
      if (!process.env[key]) {
        process.env[key] = val;
      }
    }
  }
}

async function main() {
  const address = "91 Chùa Láng, Đống Đa, Hà Nội";
  console.log(`[Geocode Store] Đang kiểm tra tọa độ cho: "${address}"...`);

  const apiKey = process.env.GOONG_API_KEY;
  if (apiKey) {
    try {
      console.log("[Geocode Store] Đang gọi Goong Geocode API...");
      const url = `https://rsapi.goong.io/v2/geocode?address=${encodeURIComponent(address)}&api_key=${apiKey}`;
      const res = await fetch(url);
      const data = await res.json();
      console.log("[Goong API Response]", JSON.stringify(data, null, 2));

      if (data.results && data.results.length > 0) {
        const first = data.results[0];
        const location = first.geometry?.location;
        console.log("[Goong Geocode Thành Công]", {
          lat: location?.lat,
          lng: location?.lng,
          formatted_address: first.formatted_address,
        });
        return;
      }
    } catch (err) {
      console.error("[Goong API Lỗi]", err);
    }
  } else {
    console.log("[Geocode Store] Chưa có GOONG_API_KEY trong môi trường. Kiểm tra qua OpenStreetMap Nominatim...");
  }

  try {
    const osmUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}`;
    const osmRes = await fetch(osmUrl, {
      headers: { "User-Agent": "HealthyFoodDelivery/1.0" },
    });
    const osmData = await osmRes.json();
    if (osmData && osmData.length > 0) {
      const first = osmData[0];
      console.log("[OSM Geocode Thành Công]", {
        lat: Number(first.lat),
        lng: Number(first.lon),
        display_name: first.display_name,
      });
    }
  } catch (err) {
    console.error("[OSM Geocode Lỗi]", err);
  }
}

main();
