import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const ROOT = process.cwd();

function loadEnvFile(filename) {
  const fullPath = path.join(ROOT, filename);
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

const seed = JSON.parse(
  fs.readFileSync(path.join(ROOT, "lib", "demo-seed.json"), "utf8")
);

const SHIPPING_FEE_VND = 15000;

function round2(n) {
  return Math.round(n * 100) / 100;
}

function calcDishPer100(recipeItems, yieldG) {
  const totals = recipeItems.reduce(
    (acc, item) => ({
      kcal: acc.kcal + (item.raw_g * item.per100.kcal) / 100,
      protein: acc.protein + (item.raw_g * item.per100.protein) / 100,
      carbs: acc.carbs + (item.raw_g * item.per100.carbs) / 100,
      fat: acc.fat + (item.raw_g * item.per100.fat) / 100
    }),
    { kcal: 0, protein: 0, carbs: 0, fat: 0 }
  );
  return {
    kcal: round2((totals.kcal / yieldG) * 100),
    protein: round2((totals.protein / yieldG) * 100),
    carbs: round2((totals.carbs / yieldG) * 100),
    fat: round2((totals.fat / yieldG) * 100)
  };
}

function calcPortion(per100, grams) {
  return {
    kcal: round2((per100.kcal * grams) / 100),
    protein: round2((per100.protein * grams) / 100),
    carbs: round2((per100.carbs * grams) / 100),
    fat: round2((per100.fat * grams) / 100)
  };
}

function todayYmdVn() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(new Date());
  const part = (type) => parts.find((v) => v.type === type)?.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}

function isRealSupabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  return (
    Boolean(url) &&
    Boolean(key) &&
    !url.includes("your-project.supabase.co") &&
    key !== "only-on-server"
  );
}

async function seedSupabase() {
  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );

  let orderProps = null;
  let snapProps = null;
  try {
    const swaggerRes = await fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/?apikey=${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      { headers: { Accept: "application/openapi+json" } }
    );
    if (swaggerRes.ok) {
      const swagger = await swaggerRes.json();
      orderProps = swagger?.definitions?.orders?.properties || null;
      snapProps = swagger?.definitions?.nutrition_snapshots?.properties || null;
    }
  } catch {
    // ignore
  }

  function pickAvailable(payload, props) {
    if (!props) return { ...payload };
    const res = {};
    for (const [k, v] of Object.entries(payload)) {
      if (k in props) {
        res[k] = v;
      }
    }
    return res;
  }

  const tablesToClear = [
    ["nutrition_snapshots", "id"],
    ["cooking_batches", "id"],
    ["order_items", "dish_id"],
    ["orders", "id"],
    ["combo_items", "combo_id"],
    ["combos", "id"],
    ["menu_dishes", "menu_day_id"],
    ["menu_days", "id"],
    ["dish_ingredients", "dish_id"],
    ["dishes", "id"],
    ["ingredients", "id"]
  ];

  for (const [table, col] of tablesToClear) {
    const query =
      col === "dish_id" && table === "order_items"
        ? db.from(table).delete().neq(col, "__never__")
        : db.from(table).delete().neq(col, "00000000-0000-0000-0000-000000000000");
    const { error } = await query;
    if (error) {
      throw new Error(`Không thể xóa bảng ${table}: ${error.message}`);
    }
  }

  const ingBySlug = new Map(seed.ingredients.map((i) => [i.id, i]));
  const dishBySlug = new Map(seed.dishes.map((d) => [d.id, d]));

  const { error: ingErr } = await db.from("ingredients").insert(
    seed.ingredients.map((i) => ({
      id: i.supabaseId,
      name: i.name,
      kcal_per100: i.kcal_per100,
      protein_per100: i.protein_per100,
      carbs_per100: i.carbs_per100,
      fat_per100: i.fat_per100,
      allergens: i.allergens,
      source: "manual"
    }))
  );
  if (ingErr) throw new Error(`Lỗi seed ingredients: ${ingErr.message}`);

  const { error: dishErr } = await db.from("dishes").insert(
    seed.dishes.map((d) => ({
      id: d.supabaseId,
      name: d.name,
      price_vnd: d.price_vnd,
      image_url: d.image_url,
      yield_g: d.yield_g,
      approved: d.approved
    }))
  );
  if (dishErr) throw new Error(`Lỗi seed dishes: ${dishErr.message}`);

  const recipeRows = seed.dishes.flatMap((d) =>
    d.recipe.map((r) => ({
      dish_id: d.supabaseId,
      ingredient_id: ingBySlug.get(r.ingredientId).supabaseId,
      raw_g: r.raw_g
    }))
  );
  const { error: recErr } = await db.from("dish_ingredients").insert(recipeRows);
  if (recErr) throw new Error(`Lỗi seed dish_ingredients: ${recErr.message}`);

  const today = todayYmdVn();
  const { data: menuDay, error: dayErr } = await db
    .from("menu_days")
    .insert({ menu_date: today, published: true })
    .select("id")
    .single();
  if (dayErr || !menuDay) throw new Error(`Lỗi seed menu_days: ${dayErr?.message}`);

  const { error: mdErr } = await db.from("menu_dishes").insert(
    seed.dishes.map((d) => ({
      menu_day_id: menuDay.id,
      dish_id: d.supabaseId,
      portion_limit: d.portion_limit,
      step_g: d.step_g,
      min_g: d.min_g,
      max_g: d.max_g
    }))
  );
  if (mdErr) throw new Error(`Lỗi seed menu_dishes: ${mdErr.message}`);

  const goals = ["balanced", "light", "protein"];
  const { data: comboRows, error: comboErr } = await db
    .from("combos")
    .insert(goals.map((goal) => ({ menu_day_id: menuDay.id, goal })))
    .select("id,goal");
  if (comboErr || !comboRows) throw new Error(`Lỗi seed combos: ${comboErr?.message}`);

  const comboItemRows = [];
  for (const combo of comboRows) {
    for (const d of seed.dishes) {
      const g = d.combos?.[combo.goal];
      if (g) {
        comboItemRows.push({
          combo_id: combo.id,
          dish_id: d.supabaseId,
          grams: g
        });
      }
    }
  }
  const { error: ciErr } = await db.from("combo_items").insert(comboItemRows);
  if (ciErr) throw new Error(`Lỗi seed combo_items: ${ciErr.message}`);

  const nowMs = Date.now();
  const { error: batchErr } = await db.from("cooking_batches").insert(
    seed.cookingBatches.map((b, i) => ({
      id: b.id,
      dish_id: dishBySlug.get(b.dishId).supabaseId,
      dish_name: b.dishName,
      lot_code: b.lotCode,
      supplier_note: b.supplierNote,
      cooked_yield_g: b.cookedYieldG,
      cooked_at: new Date(nowMs - (i + 2) * 3600_000).toISOString()
    }))
  );
  if (batchErr) throw new Error(`Lỗi seed cooking_batches: ${batchErr.message}`);

  for (let idx = 0; idx < seed.orders.length; idx++) {
    const spec = seed.orders[idx];
    const createdAt = new Date(
      nowMs - (seed.orders.length - idx) * 900_000
    ).toISOString();
    let subtotal = 0;
    const totalNutrition = { kcal: 0, protein: 0, carbs: 0, fat: 0 };

    const computedItems = spec.items.map((reqItem) => {
      const dish = dishBySlug.get(reqItem.dishId);
      const per100 = calcDishPer100(
        dish.recipe.map((r) => {
          const ing = ingBySlug.get(r.ingredientId);
          return {
            raw_g: r.raw_g,
            per100: {
              kcal: ing.kcal_per100,
              protein: ing.protein_per100,
              carbs: ing.carbs_per100,
              fat: ing.fat_per100
            }
          };
        }),
        dish.yield_g
      );
      const macros = calcPortion(per100, reqItem.grams);
      const unitPrice = Math.round((dish.price_vnd / dish.yield_g) * reqItem.grams);
      subtotal += unitPrice;
      totalNutrition.kcal = round2(totalNutrition.kcal + macros.kcal);
      totalNutrition.protein = round2(totalNutrition.protein + macros.protein);
      totalNutrition.carbs = round2(totalNutrition.carbs + macros.carbs);
      totalNutrition.fat = round2(totalNutrition.fat + macros.fat);
      return {
        dish_id: dish.supabaseId,
        name_snapshot: dish.name,
        unit_price_vnd: unitPrice,
        quantity: 1,
        nutrition_snapshot: { grams: reqItem.grams, ...macros }
      };
    });

    const paidAt = ["paid", "cooking", "packed", "delivered"].includes(spec.status)
      ? new Date(nowMs - 3000_000).toISOString()
      : null;
    const cookingAt = ["cooking", "packed", "delivered"].includes(spec.status)
      ? new Date(nowMs - 2000_000).toISOString()
      : null;
    const packedAt = ["packed", "delivered"].includes(spec.status)
      ? new Date(nowMs - 1000_000).toISOString()
      : null;
    const deliveredAt =
      spec.status === "delivered" ? new Date(nowMs - 300_000).toISOString() : null;

    const rawOrderPayload = {
      id: spec.id,
      public_token: spec.publicToken,
      public_code: spec.publicCode,
      customer_name: spec.customerName,
      phone: spec.phone,
      customer_email: spec.customerEmail,
      delivery_address: spec.deliveryAddress,
      shipping_fee_vnd: SHIPPING_FEE_VND,
      note: spec.note,
      status: spec.status,
      people: spec.people ?? 1,
      goal: spec.goal ?? "balanced",
      total_vnd: subtotal + SHIPPING_FEE_VND,
      nutrition_snapshot: totalNutrition,
      created_at: createdAt,
      paid_at: paidAt,
      cooking_at: cookingAt,
      packed_at: packedAt,
      delivered_at: deliveredAt
    };
    const orderPayload = pickAvailable(rawOrderPayload, orderProps);
    let { error: ordErr } = await db.from("orders").insert(orderPayload);
    if (ordErr && (ordErr.message.includes("'goal'") || ordErr.message.includes("'people'"))) {
      delete orderPayload.goal;
      delete orderPayload.people;
      const retry = await db.from("orders").insert(orderPayload);
      ordErr = retry.error;
    }
    if (ordErr) throw new Error(`Lỗi seed order ${spec.publicCode}: ${ordErr.message}`);

    const { data: insertedItems, error: oiErr } = await db
      .from("order_items")
      .insert(computedItems.map((it) => ({ order_id: spec.id, ...it })))
      .select("id");
    if (oiErr) throw new Error(`Lỗi seed order_items ${spec.publicCode}: ${oiErr.message}`);

    if (spec.portionSnapshot && insertedItems?.[0]) {
      const snap = spec.portionSnapshot;
      const dish = dishBySlug.get(snap.dishId);
      const per100 = calcDishPer100(
        dish.recipe.map((r) => {
          const ing = ingBySlug.get(r.ingredientId);
          return {
            raw_g: r.raw_g,
            per100: {
              kcal: ing.kcal_per100,
              protein: ing.protein_per100,
              carbs: ing.carbs_per100,
              fat: ing.fat_per100
            }
          };
        }),
        dish.yield_g
      );
      const snapMacros = calcPortion(per100, snap.actualGrams);
      const ingSnapshot = dish.recipe.map((r) => {
        const ing = ingBySlug.get(r.ingredientId);
        return { name: ing.name, rawG: r.raw_g, allergens: ing.allergens };
      });
      const allergens = Array.from(new Set(ingSnapshot.flatMap((i) => i.allergens)));

      const rawSnapPayload = {
        id: snap.id,
        order_id: spec.id,
        order_item_id: insertedItems[0].id,
        qr_code: snap.qrCode,
        dish_name: dish.name,
        cooked_at: today,
        cooked_batch_id: snap.cookedBatchId,
        actual_grams: snap.actualGrams,
        kcal: snapMacros.kcal,
        protein_g: snapMacros.protein,
        carbs_g: snapMacros.carbs,
        fat_g: snapMacros.fat,
        ingredients: ingSnapshot,
        allergens,
        source_note: snap.sourceNote,
        lot_code: snap.lotCode,
        people: spec.people ?? 1,
        per_person_estimate: snapMacros,
        packed_at: packedAt ?? createdAt
      };
      const snapPayload = pickAvailable(rawSnapPayload, snapProps);
      let { error: snapErr } = await db.from("nutrition_snapshots").insert(snapPayload);
      if (snapErr && (snapErr.message.includes("'people'") || snapErr.message.includes("'per_person_estimate'"))) {
        delete snapPayload.people;
        delete snapPayload.per_person_estimate;
        const retry = await db.from("nutrition_snapshots").insert(snapPayload);
        snapErr = retry.error;
      }
      if (snapErr) throw new Error(`Lỗi seed nutrition_snapshots: ${snapErr.message}`);
    }
  }
}

async function main() {
  let mode = "fallback";
  if (isRealSupabaseConfig()) {
    await seedSupabase();
    mode = "supabase";
  }

  try {
    fs.writeFileSync(path.join(ROOT, ".demo-seed-version"), `${Date.now()}\n`, "utf8");
  } catch {
    // ignore read-only FS
  }

  console.log(`\n[seed:demo] Đã reset dữ liệu demo thành công (mode: ${mode})`);
  console.log(`- Nguyên liệu: ${seed.ingredients.length}`);
  console.log(`- Món ăn: ${seed.dishes.length} (gồm 1 món hết suất hôm nay: "Bò áp chảo măng tây")`);
  console.log(`- Mẻ chế biến: ${seed.cookingBatches.length}`);
  console.log(`- Đơn mẫu (1 đơn ở mỗi trạng thái): ${seed.orders.length}`);
  for (const o of seed.orders) {
    console.log(`  · ${o.publicCode} [${o.status}] — ${o.customerName}`);
  }
  console.log(`- Trang QR mẫu sẵn sàng quét: /n/MHLN1005-GA-001 và /n/MHLN1006-BO-001\n`);
}

main().catch((err) => {
  console.error("[seed:demo] Lỗi:", err);
  process.exit(1);
});

