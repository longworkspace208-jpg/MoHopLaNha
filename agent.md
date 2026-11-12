# Mở Hộp Là Nhà — Tổng quan dự án

Demo đặt cơm tiếng Việt, mobile-first, xây bằng Next.js App Router, TypeScript, Tailwind CSS và Supabase Postgres. Dự án là bản trình diễn; logic server nằm trong Route Handlers và Server Actions, không có backend riêng.

## Stack và lệnh

- Next.js App Router + TypeScript + Tailwind CSS.
- Supabase (`@supabase/supabase-js`) cho Postgres.
- Zustand + `localStorage` cho lựa chọn khách và giỏ hàng tạm thời.
- `qrcode` để tạo ảnh QR thanh toán.
- Vitest cho unit test dinh dưỡng.

```powershell
npm install
npm run dev
npm test
npm run build
```

Tạo `.env.local` từ `.env.example` trước khi dùng dữ liệu Supabase.

## Biến môi trường

- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`: có thể dùng ở browser.
- `SUPABASE_SERVICE_ROLE_KEY`: chỉ server; sử dụng qua `lib/supabase/server.ts` có `server-only`.
- `USDA_API_KEY`: chỉ Route Handler USDA phía server.
- `ADMIN_PASSCODE`: đăng nhập quản trị.
- `BANK_BIN`, `BANK_ACCOUNT`, `BANK_ACCOUNT_NAME`: cấu hình ngân hàng cho bước thanh toán sau này.

## Cấu trúc chính

- `app/(customer)/`: giao diện khách; `/` chọn số người/mục tiêu, `/menu` chọn combo hoặc tự ghép.
- `app/admin/`: login, đơn hàng, nguyên liệu, món ăn và thực đơn theo ngày.
- `app/n/[code]/`: trang QR công khai không có thông tin cá nhân khách.
- `app/api/`: API đơn hàng, USDA, QR, quản trị và `GET /api/menu/today`.
- `lib/nutrition.ts`: công thức dinh dưỡng xác định, không dùng LLM.
- `supabase/schema.sql`: toàn bộ schema, gồm nguyên liệu, món, thực đơn ngày và combo.

## Đã hoàn thành

### Bảo mật và quản trị

- `/admin/login` nhận `ADMIN_PASSCODE`, tạo cookie `httpOnly` `mhln_admin`.
- `middleware.ts` chặn mọi `/admin/*` trừ `/admin/login`.
- API quản trị tự xác thực cookie phía server.
- Service role và USDA key không được gửi xuống client.

### Nguyên liệu và USDA

- CRUD nguyên liệu: kcal, protein, carbs, fat trên 100g, dị ứng, `usda_fdc_id`, nguồn dữ liệu.
- Nút tìm USDA gọi `/api/usda/search`; server gọi USDA bằng `USDA_API_KEY`.
- Nếu tên nguyên liệu đã có trong bảng `ingredients`, API trả cache từ database thay vì gọi USDA.
- Số dinh dưỡng luôn có thể sửa tay trước khi lưu.

### Món ăn và dinh dưỡng

- Tạo món với giá, ảnh URL, công thức nguyên liệu + `raw_g`, và `yield_g` sau nấu.
- `calcDish(items, yield_g)` tính chỉ số trên 100g thành phẩm theo công thức:
  `Σ(raw_g × per100 / 100) / yield_g × 100`.
- `calcPortion(per100, grams)` tính một khẩu phần từ dữ liệu trên 100g.
- Server đọc lại nguyên liệu từ database khi tạo món, không tin macro do browser gửi.
- Món mới có `approved=false`; chỉ món đã duyệt mới được chọn để bán trong thực đơn ngày.
- Unit test thịt kho và khẩu phần có trong `lib/nutrition.test.ts`.

### Thực đơn và combo

- `/admin/menu` chọn ngày, món đã duyệt, giới hạn suất, `step_g`, `min_g`, `max_g`.
- Mỗi lần lưu tạo đúng 3 combo: `balanced`, `light`, `protein`.
- Định lượng mỗi mục tiêu được lưu ở `combo_items.grams` theo từng món.
- Công bố chỉ thành công khi tất cả món bán đã duyệt và có đúng ba combo.
- `GET /api/menu/today` chỉ trả thực đơn đã công bố; trả món lẻ, giới hạn, ba combo và dinh dưỡng trên 100g do server tính từ công thức.

### Trải nghiệm khách hàng, Đặt món & Thanh toán VietQR

- `/`: chọn số người `1, 2, 3, 4, 5+` và mục tiêu `balanced`, `light`, `protein`, `custom`.
- `/menu`: hiển thị 3 combo gợi ý và danh sách món lẻ để tự ghép.
- `MealCustomizer`: tăng/giảm gram theo `step_g` trong ngưỡng `min_g..max_g`.
- `/cart`: danh sách món, gram/người và tổng gram, tạm tính, phí ship (từ `lib/delivery-config.ts`), tổng cộng; tăng/giảm gram và xóa món.
- `/checkout`: nhập họ tên, SĐT, địa chỉ, email (không bắt buộc), ghi chú; tự động kiểm tra vùng phục vụ (danh sách quận/huyện cấu hình tại `lib/delivery-config.ts`), ngoài vùng thì cảnh báo rõ ràng và chặn đặt hàng.
- `POST /api/orders`: server tính lại giá và dinh dưỡng từ DB (hoặc store fallback khi chưa có Supabase env), tạo mã `MHLN####` (4 số ngẫu nhiên không trùng), lưu snapshot món & dinh dưỡng bất biến, đặt `status='awaiting_payment'`.
- `/payment/[orderId]`: hiển thị Payment QR chuẩn VietQR (ngân hàng, STK, số tiền, nội dung = `MHLN####`), nút 'Lưu mã QR', nút 'Sao chép thông tin chuyển khoản', hướng dẫn 3 bước mở app ngân hàng; nút 'Tôi đã chuyển khoản' gọi API `POST /api/orders/[id]/confirm-transfer` CHỈ đổi `status='pending_verification'`.
- `/orders/[code]`: theo dõi trạng thái đơn hàng thời gian thực (`awaiting_payment`, `pending_verification`, `paid`, `cancelled`), xem chi tiết món, gram, giá và snapshot dinh dưỡng.

## Ràng buộc cần giữ khi phát triển tiếp

- Không dùng LLM cho tính dinh dưỡng.
- Server phải tính lại giá/dinh dưỡng từ dữ liệu database; không tin dữ liệu client.
- Nutrition Snapshot phải bất biến sau khi tạo đơn.
- Khách bấm “Tôi đã chuyển khoản” không được đổi đơn sang `paid`; chỉ quản trị viên xác nhận.
- Trang QR công khai không được trả tên, số điện thoại hoặc địa chỉ khách.
- Chỉ món `approved=true` được đưa vào thực đơn bán.

## Ghi chú schema

Khi khởi tạo database mới, chạy toàn bộ `supabase/schema.sql`. Với database đã tạo từ các bước trước, áp dụng phần migration mới cho các bảng chưa có thay vì chạy lại các câu `create` đã tồn tại.
