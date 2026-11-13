try {
  process.loadEnvFile(".env.local");
} catch {
  // Bỏ qua nếu không có .env.local
}

import { POST as createOrder } from "../app/api/orders/route";
import { POST as adminLogin } from "../app/api/admin/login/route";
import { GET as getOrderStatus } from "../app/api/orders/[token]/status/route";
import { GET as usdaSearch } from "../app/api/usda/search/route";
import { signSessionToken } from "../lib/admin-auth";
import { resetInMemoryRateLimits } from "../lib/ratelimit";

interface TestReportItem {
  endpoint: string;
  scenario: string;
  totalRequests: number;
  threshold: number;
  expected429: number;
  actual429: number;
  status: "PASS" | "FAIL";
  notes?: string;
}

const TEST_DISH_ID = "ga-nuong-com-gao-lut";

async function runRateLimitTests() {
  console.log("========================================================");
  console.log("   KIỂM THỬ BẢO VỆ TẦN SUẤT (RATE LIMIT) VÀ CHỐNG BOT   ");
  console.log("========================================================");

  resetInMemoryRateLimits();
  const reports: TestReportItem[] = [];

  // 1. POST /api/orders: 5 lần/10 phút theo IP
  {
    const testIp = "192.168.1.101";
    let count429 = 0;
    let retryAfterHeader = "";

    for (let i = 1; i <= 8; i++) {
      const req = new Request("http://localhost:3000/api/orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-forwarded-for": testIp,
        },
        body: JSON.stringify({
          customerName: "Nguyễn Văn Test",
          phone: `090100000${i}`, // SĐT khác nhau để chỉ test rate limit IP
          address: "123 Lê Lợi, Phường Bến Nghé, Quận 1, TP.HCM",
          turnstileToken: "cf_test_pass",
          items: [{ dishId: TEST_DISH_ID, grams: 350 }],
        }),
      });

      const res = await createOrder(req);
      if (res.status === 429) {
        count429++;
        retryAfterHeader = res.headers.get("Retry-After") || "";
      }
    }

    const expected = 3; // 8 - 5 = 3
    reports.push({
      endpoint: "POST /api/orders",
      scenario: "5 lần / 10 phút theo IP",
      totalRequests: 8,
      threshold: 5,
      expected429: expected,
      actual429: count429,
      status: count429 === expected ? "PASS" : "FAIL",
      notes: retryAfterHeader ? `Retry-After: ${retryAfterHeader}s` : undefined,
    });
  }

  // 2. POST /api/orders: 3 lần/10 phút theo SĐT
  {
    const targetPhone = "0988777666";
    let count429 = 0;
    let retryAfterHeader = "";

    for (let i = 1; i <= 6; i++) {
      const uniqueIp = `192.168.2.${10 + i}`; // IP khác nhau để chỉ test rate limit SĐT
      const req = new Request("http://localhost:3000/api/orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-forwarded-for": uniqueIp,
        },
        body: JSON.stringify({
          customerName: "Khách Hàng Thử Nghiệm",
          phone: targetPhone,
          address: "456 Nguyễn Huệ, Phường Bến Nghé, Quận 1, TP.HCM",
          turnstileToken: "cf_test_pass",
          items: [{ dishId: TEST_DISH_ID, grams: 350 }],
        }),
      });

      const res = await createOrder(req);
      if (res.status === 429) {
        count429++;
        retryAfterHeader = res.headers.get("Retry-After") || "";
      }
    }

    const expected = 3; // 6 - 3 = 3
    reports.push({
      endpoint: "POST /api/orders",
      scenario: "3 lần / 10 phút theo SĐT",
      totalRequests: 6,
      threshold: 3,
      expected429: expected,
      actual429: count429,
      status: count429 === expected ? "PASS" : "FAIL",
      notes: retryAfterHeader ? `Retry-After: ${retryAfterHeader}s` : undefined,
    });
  }

  // 3. Đăng nhập admin: 5 lần/15 phút theo IP
  {
    const loginIp = "192.168.3.50";
    let count429 = 0;
    let retryAfterHeader = "";

    for (let i = 1; i <= 8; i++) {
      const req = new Request("http://localhost:3000/api/admin/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-forwarded-for": loginIp,
        },
        body: JSON.stringify({ token: "wrong_password" }),
      });

      const res = await adminLogin(req);
      if (res.status === 429) {
        count429++;
        retryAfterHeader = res.headers.get("Retry-After") || "";
      }
    }

    const expected = 3; // 8 - 5 = 3
    reports.push({
      endpoint: "POST /api/admin/login",
      scenario: "5 lần / 15 phút theo IP",
      totalRequests: 8,
      threshold: 5,
      expected429: expected,
      actual429: count429,
      status: count429 === expected ? "PASS" : "FAIL",
      notes: retryAfterHeader ? `Retry-After: ${retryAfterHeader}s` : undefined,
    });
  }

  // 4. GET /api/orders/[token]/status: 60 lần/phút theo token
  {
    const testToken = "tok_test_benchmark_status_60_reqs";
    let count429 = 0;
    let retryAfterHeader = "";

    for (let i = 1; i <= 65; i++) {
      const req = new Request(`http://localhost:3000/api/orders/${testToken}/status`, {
        method: "GET",
      });

      const res = await getOrderStatus(req, {
        params: Promise.resolve({ token: testToken }),
      });
      if (res.status === 429) {
        count429++;
        retryAfterHeader = res.headers.get("Retry-After") || "";
      }
    }

    const expected = 5; // 65 - 60 = 5
    reports.push({
      endpoint: "GET /api/orders/[token]/status",
      scenario: "60 lần / phút theo token",
      totalRequests: 65,
      threshold: 60,
      expected429: expected,
      actual429: count429,
      status: count429 === expected ? "PASS" : "FAIL",
      notes: retryAfterHeader ? `Retry-After: ${retryAfterHeader}s` : undefined,
    });
  }

  // 5. /api/usda/search: 30 lần/phút theo phiên admin
  {
    const sessionToken = signSessionToken({
      exp: Date.now() + 3600 * 1000,
      role: "admin",
    });
    let count429 = 0;
    let retryAfterHeader = "";

    for (let i = 1; i <= 35; i++) {
      const req = new Request("http://localhost:3000/api/usda/search?q=chicken", {
        method: "GET",
        headers: {
          cookie: `mhln_admin_session=${sessionToken}`,
        },
      });

      const res = await usdaSearch(req);
      if (res.status === 429) {
        count429++;
        retryAfterHeader = res.headers.get("Retry-After") || "";
      }
    }

    const expected = 5; // 35 - 30 = 5
    reports.push({
      endpoint: "GET /api/usda/search",
      scenario: "30 lần / phút theo phiên admin",
      totalRequests: 35,
      threshold: 30,
      expected429: expected,
      actual429: count429,
      status: count429 === expected ? "PASS" : "FAIL",
      notes: retryAfterHeader ? `Retry-After: ${retryAfterHeader}s` : undefined,
    });
  }

  // 6. Kiểm tra đặt đơn bình thường
  {
    const normalIp = "203.0.113.88";
    const normalPhone = "0971239999";
    const req = new Request("http://localhost:3000/api/orders", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-forwarded-for": normalIp,
      },
      body: JSON.stringify({
        customerName: "Khách Thường",
        phone: normalPhone,
        address: "789 Đồng Khởi, Phường Bến Nghé, Quận 1, TP.HCM",
        turnstileToken: "cf_test_pass",
        items: [{ dishId: TEST_DISH_ID, grams: 350 }],
      }),
    });

    const res = await createOrder(req);
    const body = await res.json();
    const passed =
      res.status === 200 &&
      Boolean(body.publicToken) &&
      body.publicToken.length === 21;

    reports.push({
      endpoint: "POST /api/orders (Normal)",
      scenario: "Đặt đơn hợp lệ qua Turnstile & RateLimit",
      totalRequests: 1,
      threshold: 1,
      expected429: 0,
      actual429: 0,
      status: passed ? "PASS" : "FAIL",
      notes: passed ? `Tạo thành công token: ${body.publicToken}` : body.error,
    });
  }

  // 7. Giới hạn nghiệp vụ: Tối đa 3 đơn awaiting_payment cùng lúc theo SĐT
  {
    const businessPhone = "0945678999";
    let ordersCreated = 0;
    let blockedCode = 0;

    // Tạo 3 đơn liên tiếp từ 3 IP khác nhau
    for (let i = 1; i <= 3; i++) {
      const req = new Request("http://localhost:3000/api/orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-forwarded-for": `192.168.99.${i}`,
        },
        body: JSON.stringify({
          customerName: "Khách Nghiệp Vụ",
          phone: businessPhone,
          address: "12 Lê Duẩn, Phường Bến Nghé, Quận 1, TP.HCM",
          turnstileToken: "cf_test_pass",
          items: [{ dishId: TEST_DISH_ID, grams: 350 }],
        }),
      });
      const res = await createOrder(req);
      if (res.status === 200) ordersCreated++;
    }

    // Đơn thứ 4: Reset rate limit bộ nhớ để kiểm tra riêng rẽ giới hạn nghiệp vụ (3 đơn chưa thanh toán)
    resetInMemoryRateLimits();
    const req4 = new Request("http://localhost:3000/api/orders", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-forwarded-for": "192.168.99.4",
      },
      body: JSON.stringify({
        customerName: "Khách Nghiệp Vụ",
        phone: businessPhone,
        address: "12 Lê Duẩn, Phường Bến Nghé, Quận 1, TP.HCM",
        turnstileToken: "cf_test_pass",
        items: [{ dishId: TEST_DISH_ID, grams: 350 }],
      }),
    });
    const res4 = await createOrder(req4);
    blockedCode = res4.status;

    const passed = ordersCreated === 3 && blockedCode === 409;
    reports.push({
      endpoint: "POST /api/orders (Business)",
      scenario: "Tối đa 3 đơn awaiting_payment / SĐT",
      totalRequests: 4,
      threshold: 3,
      expected429: 0,
      actual429: 0,
      status: passed ? "PASS" : "FAIL",
      notes: passed
        ? "Đơn thứ 4 bị từ chối 409 thành công"
        : `Tạo: ${ordersCreated}/3, Đơn 4 status: ${blockedCode}`,
    });
  }

  // In bảng kết quả
  console.log("\nKẾT QUẢ KIỂM THỬ:");
  console.log("+-------------------------------+----------------------------------+-------+----------+----------+--------+");
  console.log("| Endpoint                      | Kịch bản                         | Tổng  | Ngưỡng   | Nhận 429 | Status |");
  console.log("+-------------------------------+----------------------------------+-------+----------+----------+--------+");

  let allPass = true;
  for (const r of reports) {
    if (r.status !== "PASS") allPass = false;
    const ep = r.endpoint.padEnd(29, " ");
    const sc = r.scenario.padEnd(32, " ");
    const tot = String(r.totalRequests).padStart(5, " ");
    const th = String(r.threshold).padStart(8, " ");
    const got = String(r.actual429).padStart(8, " ");
    const st = r.status === "PASS" ? " PASS " : " FAIL ";
    console.log(`| ${ep} | ${sc} | ${tot} | ${th} | ${got} | ${st} |`);
    if (r.notes) {
      console.log(`|   -> Ghi chú: ${r.notes.padEnd(87, " ")} |`);
    }
  }
  console.log("+-------------------------------+----------------------------------+-------+----------+----------+--------+");

  if (allPass) {
    console.log("\n✅ TẤT CẢ CÁC KIỂM THỬ RATE LIMIT VÀ CHỐNG BOT ĐỀU ĐẠT CHUẨN!");
    process.exit(0);
  } else {
    console.error("\n❌ CÓ KIỂM THỬ THẤT BẠI!");
    process.exit(1);
  }
}

runRateLimitTests().catch((err) => {
  console.error("Lỗi thực thi test-ratelimit:", err);
  process.exit(1);
});
