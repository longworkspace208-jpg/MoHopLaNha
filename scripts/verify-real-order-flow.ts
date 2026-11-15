import fs from "node:fs";
import {
  createOrderInDb,
  getAllOrders,
  getOrderByPublicToken,
  transitionOrderStatus,
} from "../lib/orders-db";
import { createClient } from "@supabase/supabase-js";

// Load env
if (fs.existsSync(".env.local")) {
  const content = fs.readFileSync(".env.local", "utf8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
    const idx = trimmed.indexOf("=");
    const key = trimmed.slice(0, idx).trim();
    const val = trimmed.slice(idx + 1).trim();
    if (!process.env[key]) {
      process.env[key] = val;
    }
  }
}

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function runVerification() {
  console.log("==================================================");
  console.log("KIỂM THỬ TOÀN DIỆN LUỒNG ĐẶT VÀ QUẢN TRỊ ĐƠN HÀNG");
  console.log("==================================================");

  // 1. Tạo đơn hàng thực tế
  console.log("\n[1] Khách đặt đơn mới qua createOrderInDb...");
  const created = await createOrderInDb({
    customerName: "Trương Văn An",
    phone: "0912345678",
    deliveryAddress: "123 Lê Lợi, Phường Bến Nghé, Quận 1",
    customerEmail: "an.truong@example.com",
    note: "Giao trước 11h30 trưa",
    items: [{ dishId: "ga-nuong-com-gao-lut", grams: 350 }],
    people: 1,
    goal: "balanced",
  });
  console.log("✓ Đã tạo đơn thành công:", {
    orderId: created.orderId,
    publicCode: created.publicCode,
    publicToken: created.publicToken,
  });

  // 2. Xác thực lưu trực tiếp vào Supabase database
  console.log("\n[2] Kiểm tra dữ liệu được lưu trong Supabase...");
  const { data: dbOrder, error: errDb } = await db
    .from("orders")
    .select("*")
    .eq("id", created.orderId)
    .single();

  if (errDb || !dbOrder) {
    throw new Error(`Đơn hàng chưa lưu vào Supabase: ${errDb?.message}`);
  }
  console.log("✓ Tìm thấy đơn trong Supabase table 'orders':", {
    id: dbOrder.id,
    public_code: dbOrder.public_code,
    status: dbOrder.status,
    total_vnd: dbOrder.total_vnd,
    customer: dbOrder.customer_name,
  });

  const { data: dbItems, error: errItems } = await db
    .from("order_items")
    .select("*")
    .eq("order_id", created.orderId);
  if (errItems || !dbItems?.length) {
    throw new Error(`Món ăn chưa lưu vào Supabase order_items: ${errItems?.message}`);
  }
  console.log("✓ Món ăn lưu trong Supabase table 'order_items':", {
    dishName: dbItems[0].name_snapshot,
    price: dbItems[0].unit_price_vnd,
    dishId: dbItems[0].dish_id,
  });

  // 3. Admin tra cứu danh sách đơn hàng
  console.log("\n[3] Admin xem danh sách đơn hàng qua getAllOrders()...");
  const allOrders = await getAllOrders();
  console.log(`✓ Admin nhận được tổng cộng ${allOrders.length} đơn hàng từ database.`);
  const foundInAdmin = allOrders.find((o) => o.id === created.orderId);
  if (!foundInAdmin) {
    throw new Error("Admin không tìm thấy đơn hàng vừa đặt!");
  }
  console.log("✓ Admin thấy đúng đơn mới:", {
    code: foundInAdmin.public_code,
    status: foundInAdmin.status,
    total: foundInAdmin.total_vnd,
    customer: foundInAdmin.customer_name,
  });

  // 4. Khách theo dõi đơn hàng bằng public_token
  console.log("\n[4] Khách theo dõi đơn hàng qua getOrderByPublicToken()...");
  const customerView = await getOrderByPublicToken(created.publicToken);
  if (!customerView) {
    throw new Error("Khách không thể tìm thấy đơn bằng public_token!");
  }
  console.log("✓ Khách tra cứu đúng đơn:", {
    code: customerView.public_code,
    token: customerView.public_token,
    status: customerView.status,
    itemsCount: customerView.items.length,
  });

  // 5. Khách báo đã chuyển khoản (pending_verification)
  console.log("\n[5] Khách bấm 'Tôi đã chuyển khoản' (chuyển sang pending_verification)...");
  const toPending = await transitionOrderStatus(created.orderId, "pending_verification", {
    actor: "customer",
    note: "Khách xác nhận đã chuyển khoản",
  });
  if (!toPending.ok) throw new Error("Chuyển trạng thái pending_verification thất bại");
  const trackedPending = await getOrderByPublicToken(created.publicToken);
  console.log("✓ Trạng thái mới của đơn:", trackedPending?.status);

  // 6. Admin xác nhận thanh toán (paid)
  console.log("\n[6] Admin bấm 'Đã nhận tiền, bắt đầu chuẩn bị' (chuyển sang paid)...");
  const toPaid = await transitionOrderStatus(created.orderId, "paid", {
    actor: "admin",
    note: "Admin xác nhận khớp giao dịch ngân hàng",
  });
  if (!toPaid.ok) throw new Error("Chuyển trạng thái paid thất bại");
  const trackedPaid = await getOrderByPublicToken(created.publicToken);
  console.log("✓ Trạng thái mới:", trackedPaid?.status, "· Paid at:", trackedPaid?.paid_at);

  // 7. Admin bắt đầu nấu (cooking)
  console.log("\n[7] Admin bấm 'Bắt đầu nấu' (chuyển sang cooking)...");
  const toCooking = await transitionOrderStatus(created.orderId, "cooking", {
    actor: "admin",
    note: "Bếp bắt đầu chế biến",
  });
  if (!toCooking.ok) throw new Error("Chuyển trạng thái cooking thất bại");
  const trackedCooking = await getOrderByPublicToken(created.publicToken);
  console.log("✓ Trạng thái mới:", trackedCooking?.status, "· Cooking at:", trackedCooking?.cooking_at);

  // 8. Admin đóng gói xong (packed)
  console.log("\n[8] Admin bấm 'Đóng gói xong (Chờ giao)' (chuyển sang packed)...");
  const toPacked = await transitionOrderStatus(created.orderId, "packed", {
    actor: "admin",
    note: "Bếp đã cân và đóng gói hộp cơm",
  });
  if (!toPacked.ok) throw new Error("Chuyển trạng thái packed thất bại");
  const trackedPacked = await getOrderByPublicToken(created.publicToken);
  console.log("✓ Trạng thái mới:", trackedPacked?.status, "· Packed at:", trackedPacked?.packed_at);

  // 9. Admin chuyển sang đã giao (delivered)
  console.log("\n[9] Admin bấm 'Giao hàng (Xác nhận đã giao)' (chuyển sang delivered)...");
  const toDelivered = await transitionOrderStatus(created.orderId, "delivered", {
    actor: "admin",
    note: "Shipper đã giao thành công tới tay khách",
  });
  if (!toDelivered.ok) throw new Error("Chuyển trạng thái delivered thất bại");
  const trackedDelivered = await getOrderByPublicToken(created.publicToken);
  console.log("✓ Trạng thái mới:", trackedDelivered?.status, "· Delivered at:", trackedDelivered?.delivered_at);

  // 10. Kiểm tra xác nhận cuối cùng trong Supabase
  console.log("\n[10] Đối chiếu dữ liệu thực tế tại Supabase...");
  const { data: finalDb } = await db
    .from("orders")
    .select("id, public_code, status, paid_at, cooking_at, packed_at, delivered_at")
    .eq("id", created.orderId)
    .single();

  console.log("✓ Đơn hàng hoàn tất trọn vẹn trong Supabase:", finalDb);
  console.log("\n>>> KẾT QUẢ: TOÀN BỘ LUỒNG ĐẶT HÀNG, QUẢN TRỊ VÀ THEO DÕI HOẠT ĐỘNG 100% TRÊN SUPABASE THỰC TẾ! <<<");
}

runVerification().catch((err) => {
  console.error("XẢY RA LỖI KIỂM THỬ:", err);
  process.exit(1);
});

