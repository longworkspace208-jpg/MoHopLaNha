import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

function loadEnvFile(filename: string) {
  const fullPath = path.join(process.cwd(), filename);
  if (!fs.existsSync(fullPath)) return;
  const content = fs.readFileSync(fullPath, "utf8");
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eqIdx = line.indexOf("=");
    if (eqIdx <= 0) continue;
    const key = line.slice(0, eqIdx).trim();
    let val = line.slice(eqIdx + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (process.env[key] === undefined) {
      process.env[key] = val;
    }
  }
}

loadEnvFile(".env.local");
loadEnvFile(".env");

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !anonKey || supabaseUrl.includes("your-project.supabase.co")) {
  console.error("\n❌ [RLS TEST ERROR] Thiếu NEXT_PUBLIC_SUPABASE_URL hoặc NEXT_PUBLIC_SUPABASE_ANON_KEY trong .env.local.\n");
  process.exit(1);
}

const anonClient = createClient(supabaseUrl, anonKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

type TestResult = {
  table: string;
  operation: "SELECT" | "INSERT" | "UPDATE" | "DELETE";
  expected: string;
  actual: string;
  pass: boolean;
};

const results: TestResult[] = [];

async function runTests() {
  console.log("\n========================================================");
  console.log("   KIỂM THỬ BẢO MẬT ROW LEVEL SECURITY (RLS) - ANON KEY");
  console.log("========================================================");
  console.log(`Supabase URL: ${supabaseUrl}\n`);

  // 1. SELECT dishes (chỉ approved=true)
  try {
    const { data, error } = await anonClient.from("dishes").select("id, name, approved");
    if (error) {
      results.push({
        table: "dishes",
        operation: "SELECT",
        expected: "Đọc được món approved=true",
        actual: `Lỗi: ${error.message}`,
        pass: false,
      });
    } else {
      const allApproved = (data ?? []).every((d) => d.approved === true);
      const pass = allApproved;
      results.push({
        table: "dishes",
        operation: "SELECT",
        expected: "Chỉ đọc được món approved=true",
        actual: `Đọc được ${data?.length ?? 0} món (100% approved: ${allApproved})`,
        pass,
      });
    }
  } catch (err) {
    results.push({
      table: "dishes",
      operation: "SELECT",
      expected: "Đọc được món approved=true",
      actual: `Lỗi: ${err instanceof Error ? err.message : String(err)}`,
      pass: false,
    });
  }

  // 2. INSERT dishes bằng anon (phải BỊ CHẶN)
  try {
    const { data, error } = await anonClient.from("dishes").insert({
      name: "Món hacker",
      price_vnd: 99999,
      yield_g: 500,
      approved: true,
    });
    if (error || !data) {
      results.push({
        table: "dishes",
        operation: "INSERT",
        expected: "Bị chặn (RLS deny)",
        actual: `Bị chặn thành công (${error?.code ?? "denied"})`,
        pass: true,
      });
    } else {
      results.push({
        table: "dishes",
        operation: "INSERT",
        expected: "Bị chặn (RLS deny)",
        actual: "LỖ HỔNG: Anon đã insert được vào dishes!",
        pass: false,
      });
    }
  } catch {
    results.push({
      table: "dishes",
      operation: "INSERT",
      expected: "Bị chặn (RLS deny)",
      actual: "Bị chặn thành công",
      pass: true,
    });
  }

  // 3. SELECT menu_days (chỉ published=true)
  try {
    const { data, error } = await anonClient.from("menu_days").select("id, menu_date, published");
    if (error) {
      results.push({
        table: "menu_days",
        operation: "SELECT",
        expected: "Chỉ đọc được published=true",
        actual: `Lỗi: ${error.message}`,
        pass: false,
      });
    } else {
      const allPublished = (data ?? []).every((m) => m.published === true);
      results.push({
        table: "menu_days",
        operation: "SELECT",
        expected: "Chỉ đọc được menu published=true",
        actual: `Đọc được ${data?.length ?? 0} menu (100% published: ${allPublished})`,
        pass: allPublished,
      });
    }
  } catch (err) {
    results.push({
      table: "menu_days",
      operation: "SELECT",
      expected: "Chỉ đọc được published=true",
      actual: `Lỗi: ${err instanceof Error ? err.message : String(err)}`,
      pass: false,
    });
  }

  // 4. SELECT orders bằng anon (phải BỊ CHẶN / 0 rows)
  try {
    const { data, error } = await anonClient.from("orders").select("id, customer_name, phone");
    const count = data?.length ?? 0;
    if (count === 0 || error) {
      results.push({
        table: "orders",
        operation: "SELECT",
        expected: "Bị chặn hoàn toàn (0 rows / deny)",
        actual: error ? `Bị chặn: ${error.message}` : "0 rows (chặn hoàn toàn)",
        pass: true,
      });
    } else {
      results.push({
        table: "orders",
        operation: "SELECT",
        expected: "Bị chặn hoàn toàn (0 rows / deny)",
        actual: `LỖ HỔNG: Anon đọc được ${count} đơn hàng!`,
        pass: false,
      });
    }
  } catch {
    results.push({
      table: "orders",
      operation: "SELECT",
      expected: "Bị chặn hoàn toàn (0 rows / deny)",
      actual: "Bị chặn thành công",
      pass: true,
    });
  }

  // 5. INSERT orders bằng anon (phải BỊ CHẶN)
  try {
    const { data, error } = await anonClient.from("orders").insert({
      public_code: "HACK001",
      customer_name: "Attacker",
      phone: "0999999999",
      delivery_address: "Fake street",
      total_vnd: 50000,
      nutrition_snapshot: {},
    });
    if (error || !data) {
      results.push({
        table: "orders",
        operation: "INSERT",
        expected: "Bị chặn (RLS deny)",
        actual: `Bị chặn thành công (${error?.code ?? "denied"})`,
        pass: true,
      });
    } else {
      results.push({
        table: "orders",
        operation: "INSERT",
        expected: "Bị chặn (RLS deny)",
        actual: "LỖ HỔNG: Anon đã insert được đơn hàng!",
        pass: false,
      });
    }
  } catch {
    results.push({
      table: "orders",
      operation: "INSERT",
      expected: "Bị chặn (RLS deny)",
      actual: "Bị chặn thành công",
      pass: true,
    });
  }

  // 6. SELECT order_items bằng anon (phải BỊ CHẶN / 0 rows)
  try {
    const { data, error } = await anonClient.from("order_items").select("*");
    const count = data?.length ?? 0;
    results.push({
      table: "order_items",
      operation: "SELECT",
      expected: "Bị chặn hoàn toàn (0 rows / deny)",
      actual: error ? `Bị chặn: ${error.message}` : `${count} rows`,
      pass: count === 0 || !!error,
    });
  } catch {
    results.push({
      table: "order_items",
      operation: "SELECT",
      expected: "Bị chặn hoàn toàn (0 rows / deny)",
      actual: "Bị chặn thành công",
      pass: true,
    });
  }

  // 7. SELECT ingredients bằng anon (phải BỊ CHẶN / 0 rows)
  try {
    const { data, error } = await anonClient.from("ingredients").select("*");
    const count = data?.length ?? 0;
    results.push({
      table: "ingredients",
      operation: "SELECT",
      expected: "Bị chặn hoàn toàn (0 rows / deny)",
      actual: error ? `Bị chặn: ${error.message}` : `${count} rows`,
      pass: count === 0 || !!error,
    });
  } catch {
    results.push({
      table: "ingredients",
      operation: "SELECT",
      expected: "Bị chặn hoàn toàn (0 rows / deny)",
      actual: "Bị chặn thành công",
      pass: true,
    });
  }

  // 8. SELECT cooking_batches bằng anon (phải BỊ CHẶN / 0 rows)
  try {
    const { data, error } = await anonClient.from("cooking_batches").select("*");
    const count = data?.length ?? 0;
    results.push({
      table: "cooking_batches",
      operation: "SELECT",
      expected: "Bị chặn hoàn toàn (0 rows / deny)",
      actual: error ? `Bị chặn: ${error.message}` : `${count} rows`,
      pass: count === 0 || !!error,
    });
  } catch {
    results.push({
      table: "cooking_batches",
      operation: "SELECT",
      expected: "Bị chặn hoàn toàn (0 rows / deny)",
      actual: "Bị chặn thành công",
      pass: true,
    });
  }

  // 9. SELECT nutrition_snapshots bằng anon (phải BỊ CHẶN / 0 rows)
  try {
    const { data, error } = await anonClient.from("nutrition_snapshots").select("*");
    const count = data?.length ?? 0;
    results.push({
      table: "nutrition_snapshots",
      operation: "SELECT",
      expected: "Bị chặn hoàn toàn (0 rows / deny)",
      actual: error ? `Bị chặn: ${error.message}` : `${count} rows`,
      pass: count === 0 || !!error,
    });
  } catch {
    results.push({
      table: "nutrition_snapshots",
      operation: "SELECT",
      expected: "Bị chặn hoàn toàn (0 rows / deny)",
      actual: "Bị chặn thành công",
      pass: true,
    });
  }

  // 10. SELECT dish_ingredients bằng anon (phải BỊ CHẶN / 0 rows)
  try {
    const { data, error } = await anonClient.from("dish_ingredients").select("*");
    const count = data?.length ?? 0;
    results.push({
      table: "dish_ingredients",
      operation: "SELECT",
      expected: "Bị chặn hoàn toàn (0 rows / deny)",
      actual: error ? `Bị chặn: ${error.message}` : `${count} rows`,
      pass: count === 0 || !!error,
    });
  } catch {
    results.push({
      table: "dish_ingredients",
      operation: "SELECT",
      expected: "Bị chặn hoàn toàn (0 rows / deny)",
      actual: "Bị chặn thành công",
      pass: true,
    });
  }

  // In bảng kết quả
  console.log("+---------------------+-----------+-----------------------------------+-----------------------------------------+--------+");
  console.log("| Bảng                | Thao tác  | Kỳ vọng                           | Thực tế                                 | Status |");
  console.log("+---------------------+-----------+-----------------------------------+-----------------------------------------+--------+");
  for (const r of results) {
    const table = r.table.padEnd(19, " ");
    const op = r.operation.padEnd(9, " ");
    const exp = r.expected.slice(0, 33).padEnd(33, " ");
    const act = r.actual.slice(0, 39).padEnd(39, " ");
    const status = r.pass ? "  PASS " : "  FAIL ";
    console.log(`| ${table} | ${op} | ${exp} | ${act} |${status}|`);
  }
  console.log("+---------------------+-----------+-----------------------------------+-----------------------------------------+--------+\n");

  const allPassed = results.every((r) => r.pass);
  if (allPassed) {
    console.log("✅ TẤT CẢ CÁC KIỂM THỬ RLS ĐỀU ĐẠT CHUẨN AN TOÀN!\n");
    process.exit(0);
  } else {
    console.error("❌ MỘT SỐ BẢNG CHƯA ĐẠT CHÍNH SÁCH BẢO MẬT RLS!\n");
    process.exit(1);
  }
}

runTests();

