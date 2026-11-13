# Mở Hộp Là Nhà (HealthyFood)

Ứng dụng web đặt cơm gia đình lành mạnh, minh bạch định lượng & dinh dưỡng (mobile-first), xây dựng bằng **Next.js App Router**, **TypeScript**, **Tailwind CSS** và **Supabase Postgres**.

> Tính toán dinh dưỡng sử dụng công thức xác định theo gram nguyên liệu thực tế (`lib/nutrition.ts`), hoàn toàn không dùng LLM. Dữ liệu dinh dưỡng gắn với mỗi đơn và mỗi hộp cơm sau đóng gói là bản chụp bất biến (**Nutrition Snapshot**).

---

## 1. Yêu cầu hệ thống & Cài đặt

- **Node.js** `>= 20` (khuyến nghị Node 20 LTS hoặc 22/24)
- **npm** đi kèm Node.js
- (Tùy chọn) Tài khoản **Supabase** nếu chạy với Postgres thực; nếu chưa cấu hình Supabase, app tự động chạy ở chế độ **demo fallback in-memory**.

### Các bước cài đặt local

```bash
# 1. Cài đặt dependencies
npm install

# 2. Tạo file biến môi trường từ file mẫu
cp .env.example .env.local
# Trên Windows PowerShell:
# Copy-Item .env.example .env.local

# 3. Khởi tạo schema database (nếu dùng Supabase)
# Mở Supabase SQL Editor và chạy toàn bộ file supabase/schema.sql

# 4. Nạp / reset dữ liệu demo (nguyên liệu, 5 món, thực đơn hôm nay, 2 mẻ nấu, 7 đơn mẫu)
npm run seed:demo

# 5. Chạy server development
npm run dev
```

Mở trình duyệt tại `http://localhost:3000` (hoặc port mà `next dev` hiển thị).

### Các lệnh kiểm tra nhanh

```bash
npm run lint        # Kiểm tra ESLint
npm test            # Chạy unit & flow tests (Vitest)
npm run build       # Biên dịch production
npm run seed:demo   # Reset dữ liệu demo (Supabase nếu đã cấu hình, hoặc store demo cục bộ)
```

---

## 2. Danh sách biến môi trường

Sao chép từ [`.env.example`](./.env.example) sang `.env.local` khi chạy local:

| Biến môi trường | Phạm vi | Bắt buộc | Mô tả |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Client & Server | Khi dùng Supabase | URL project Supabase (`https://xxx.supabase.co`) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Client & Server | Khi dùng Supabase | Anon/public key của project Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | **Chỉ Server** | Khi dùng Supabase | Service role key dùng trong Route Handlers / Server Actions & `seed:demo` |
| `USDA_API_KEY` | **Chỉ Server** | Tùy chọn | API key tra cứu nguyên liệu USDA FoodData Central (`/api/usda/search`) |
| `ADMIN_PASSCODE` | **Chỉ Server** | **Bắt buộc cho `/admin`** | Mật khẩu đăng nhập trang quản trị `/admin/login` (lưu cookie `httpOnly` `mhln_admin`) |
| `BANK_BIN` | Server | Khuyến nghị | Mã BIN ngân hàng theo chuẩn Napas/VietQR (vd: `970436`, `970415`, `970422`) |
| `BANK_ACCOUNT` | Server | Khuyến nghị | Số tài khoản ngân hàng nhận tiền VietQR |
| `BANK_ACCOUNT_NAME` | Server | Khuyến nghị | Tên chủ tài khoản (không dấu, viết hoa, vd: `MO HOP LA NHA`) |
| `NEXT_PUBLIC_SITE_URL` | Client & Server | **Bắt buộc khi deploy** | URL gốc của website (vd: `https://your-app.vercel.app`) để sinh link QR trên tem nhãn `{SITE_URL}/n/{qr_code}` |

> **Lưu ý bảo mật:** Không bao giờ gắn tiền tố `NEXT_PUBLIC_` cho `SUPABASE_SERVICE_ROLE_KEY`, `USDA_API_KEY` hay `ADMIN_PASSCODE`.

---

## 3. Hướng dẫn chạy kịch bản demo 6 bước

Trước khi bắt đầu demo, chạy lệnh reset dữ liệu mẫu:

```bash
npm run seed:demo
```

Lệnh này tạo sẵn **5 món ăn** (gồm món `"Bò áp chảo măng tây"` ở trạng thái **Hết suất hôm nay**), **2 mẻ chế biến**, **7 đơn mẫu ở đủ 7 trạng thái** (`awaiting_payment`, `pending_verification`, `paid`, `cooking`, `packed`, `delivered`, `cancelled`) và sẵn 2 mã QR mẫu (`/n/MHLN1005-GA-001`, `/n/MHLN1006-BO-001`).

### Bước 1 — Chọn số người ăn & mục tiêu (`/`)
1. Mở `/` trên điện thoại (`375px`) hoặc desktop.
2. Chọn **2 người** và mục tiêu **Cân bằng** (hoặc **Nhiều protein**).
3. Bấm **"Xem gợi ý thực đơn"** để chuyển sang `/menu`.

### Bước 2 — Chọn combo hoặc tùy chỉnh gram (`/menu` & `/cart`)
1. Trên `/menu`, chọn một trong **3 combo gợi ý** hoặc bấm **Thêm** món lẻ (có thể thử nút **Bò áp chảo măng tây** đang hiển thị **Hết suất hôm nay**).
2. Điều chỉnh tăng/giảm gram từng món ở phần **Tùy chỉnh bữa ăn** và kiểm tra tổng tiền, kcal, protein chia đều cho 2 người.
3. Bấm **"Đến giỏ hàng & Đặt món"** để mở `/cart`, kiểm tra tạm tính, phí ship và thử chỉnh sửa/xóa món (nếu xóa hết sẽ hiện trạng thái **Giỏ hàng đang trống**).

### Bước 3 — Nhập địa chỉ & kiểm tra vùng phục vụ (`/checkout`)
1. Bấm **"Tiến hành đặt hàng"** để vào `/checkout`.
2. Nhập thử địa chỉ ngoài vùng (vd: `99 Cầu Giấy, Hà Nội`) để thấy cảnh báo đỏ **ngoài vùng phục vụ** và nút đặt đơn bị khóa.
3. Đổi sang địa chỉ hợp lệ trong vùng phục vụ config (`lib/delivery-config.ts`), vd: `123 Lê Lợi, Bến Nghé, Quận 1`, nhập Họ tên + SĐT (`0901234567`).
4. Bấm **"Đặt cơm & Nhận mã VietQR"** → Server tự tính lại giá & dinh dưỡng, tạo mã đơn `MHLN####` ở trạng thái `awaiting_payment`.

### Bước 4 — Thanh toán VietQR & theo dõi đơn (`/payment/[orderId]` & `/orders/[code]`)
1. Trên `/payment/[orderId]`, kiểm tra mã VietQR, số tiền, nội dung chuyển khoản `MHLN####`, thử nút **Lưu mã QR** và **Sao chép thông tin**.
2. Bấm **"Tôi đã chuyển khoản"** → Trạng thái chuyển sang **`pending_verification`** (chưa `paid`) và chuyển sang `/orders/MHLN####` để khách theo dõi.

### Bước 5 — Quản trị xác nhận tiền, chế biến, đóng gói & in tem (`/admin`)
1. Mở `/admin/login`, đăng nhập bằng `ADMIN_PASSCODE` đã cấu hình.
2. Tại `/admin/orders`, lọc tab `pending_verification`, mở đơn vừa đặt và bấm **"Xác nhận đã nhận tiền"** → đơn chuyển **`paid`**.
3. Mở `/admin/cooking`, tạo mẻ nấu mới (ghi nhận `lot_code`, nguồn gốc nguyên liệu, sản lượng nấu thực tế) và bấm **"Bắt đầu chế biến"** cho đơn (`paid` → **`cooking`**). (Ngoài ra có thể thử tạo đơn thủ công tại `/admin/orders/facebook`).
4. Mở `/admin/orders/[id]/pack`, chọn mẻ nấu, điều chỉnh định lượng cân thực tế (gram) và bấm **"Xác nhận khẩu phần"** → hệ thống tạo `nutrition_snapshots` bất biến và chuyển đơn sang **`packed`**.
5. Bấm **"In tem QR"** (`/admin/orders/[id]/labels`) để xem tem in có QR trỏ tới `{NEXT_PUBLIC_SITE_URL}/n/{qr_code}` và bấm **"Đã giao"** để hoàn tất **`delivered`**.

### Bước 6 — Quét Nutrition QR công khai (`/n/[code]`)
1. Mở trực tiếp URL trên tem QR (ví dụ `/n/MHLN1005-GA-001` hoặc mã suất vừa tạo ở Bước 5).
2. Xác nhận trang hiển thị chuẩn mobile-first: tên món, mã suất, định lượng thực, ngày chế biến, thời điểm đóng gói, kcal/protein/carbs/fat **(ước tính)**, nguyên liệu + cảnh báo dị ứng, nguồn gốc & mã lô (`lot_code`), và **không hiển thị bất kỳ thông tin cá nhân khách hàng nào** (`noindex`).
3. Thử mở mã QR sai như `/n/MHLN0000-XX-999` → hiển thị trang 404 tiếng Việt thân thiện (`Không tìm thấy mã suất ăn`).

---

## 4. Hướng dẫn deploy lên Vercel

### Bước 1 — Chuẩn bị Supabase (Database Production)
1. Tạo project mới trên [Supabase](https://supabase.com/).
   > [!IMPORTANT]
   > **Vùng bắt buộc (Region):** Phải chọn vùng **Singapore (`ap-southeast-1`)** để đặt cùng khu vực (co-location) với serverless compute của Vercel (`sin1`), giảm triệt để độ trễ kết nối (network RTT) xuống dưới 15ms. **Lưu ý:** Vùng của Supabase không thể thay đổi sau khi đã tạo; nếu đang ở vùng khác (như US/EU), bắt buộc phải tạo project mới ở Singapore và chuyển dữ liệu sang.
2. Vào **SQL Editor** và chạy toàn bộ nội dung file [`supabase/schema.sql`](./supabase/schema.sql) và các bản migration trong thư mục [`supabase/migrations/`](./supabase/migrations/).
3. Lấy 3 giá trị trong **Project Settings → API**:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`

### Bước 2 — Tạo project trên Vercel
1. Push mã nguồn lên GitHub / GitLab / Bitbucket.
2. Đăng nhập [Vercel](https://vercel.com/), chọn **Add New… → Project** và import repository.
3. Giữ nguyên cấu hình mặc định của Next.js:
   - **Framework Preset**: `Next.js`
   - **Install Command**: `npm install`
   - **Build Command**: `npm run build`

### Bước 3 — Khai báo Environment Variables trên Vercel
Trong phần **Settings → Environment Variables** của project Vercel (áp dụng cho cả **Production** và **Preview**), thêm đầy đủ các biến sau:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
USDA_API_KEY=your-usda-api-key
ADMIN_PASSCODE=your-strong-admin-passcode
BANK_BIN=970436
BANK_ACCOUNT=0123456789
BANK_ACCOUNT_NAME=MO HOP LA NHA
NEXT_PUBLIC_SITE_URL=https://your-domain.vercel.app
```

> **Quan trọng:** Sau khi Vercel cấp tên miền (vd: `https://mo-hop-la-nha.vercel.app`), hãy cập nhật đúng giá trị cho `NEXT_PUBLIC_SITE_URL` rồi bấm **Redeploy** để QR code trên tem `/admin/orders/[id]/labels` trỏ đúng về tên miền thật.

### Bước 4 — Nạp dữ liệu demo cho Database Production (tùy chọn)
Từ máy local (khi `.env.local` đã trỏ tới Supabase production hoặc gán env tạm thời), chạy:

```bash
npm run seed:demo
```

### Bước 5 — Kiểm tra sau deploy
1. Truy cập `/` và đặt thử 1 đơn từ bước chọn người ăn → `/payment/[orderId]`.
2. Đăng nhập `/admin/login` bằng `ADMIN_PASSCODE`, chuyển đơn qua `paid` → `cooking` → `packed`.
3. Mở `/admin/orders/[id]/labels`, kiểm tra mã QR trỏ về `https://your-domain.vercel.app/n/{qr_code}` và mở bằng điện thoại để kiểm tra trang dinh dưỡng công khai.

---

## 5. Tối ưu hóa hiệu năng & Báo cáo Lighthouse Mobile

Dự án đã được thực hiện gói tối ưu hóa hiệu năng toàn diện trên Next.js App Router và kiến trúc dữ liệu Supabase, kiểm nghiệm trực tiếp qua công cụ **Google Lighthouse Mobile** (mô phỏng mạng 4G và CPU di động).

### Kết quả đo kiểm trước và sau (Lighthouse Mobile)

| Chỉ số Lighthouse Mobile | Trước tối ưu (Baseline) | Sau tối ưu (Optimized) | Cải thiện |
| :--- | :---: | :---: | :---: |
| **Performance Score** | **78 / 100** | **87 / 100** | **+9 điểm** 🟢 |
| **First Contentful Paint (FCP)** | 1.8 s | **1.0 s** | **Nhanh hơn 44%** 🚀 |
| **Largest Contentful Paint (LCP)** | 5.7 s | **3.9 s** *(thực tế unthrottled: 308 ms)* | **Giảm 32% (tiết kiệm 1.8s)** ⚡ |
| **Speed Index (SI)** | 1.8 s | **1.1 s** | **Nhanh hơn 39%** |
| **Total Blocking Time (TBT)** | 50 ms | **130 ms** | Tối ưu luồng JS |
| **Cumulative Layout Shift (CLS)** | 0.000 | **0.035** | Ổn định layout tuyệt đối |

> [!NOTE]
> Thời gian tải phân rã của phần tử LCP chính (đĩa món cá hồi hero) ở môi trường mạng thực tế chỉ mất **308 ms**:
> - **Time to first byte (TTFB):** 8.3 ms
> - **Resource load delay:** 9.4 ms
> - **Resource load duration:** 13.7 ms
> - **Element render delay:** 276.8 ms
> Điểm đánh giá LCP request discovery đạt điểm tuyệt đối **100/100** (`fetchPriority="high"`, nạp sẵn ngay từ HTML ban đầu).

### Kích thước JS Bundle sau khi Build Production (`next build`)

Trang chủ (`/`) được cấu hình tĩnh hoàn toàn (`export const dynamic = "force-static"`), trang thực đơn (`/menu`) nạp tĩnh theo cơ chế ISR tái tạo sau 1 giờ:

```
Route (app)                                    Size  First Load JS  Revalidate
┌ ○ / (Trang chủ)                           9.42 kB         122 kB  (Hoàn toàn tĩnh)
├ ○ /menu (Thực đơn & Combo)                5.06 kB         118 kB  1h (ISR Cache)
├ ○ /cart (Giỏ hàng)                        4.39 kB         117 kB  (Hoàn toàn tĩnh)
├ ○ /checkout (Đặt đơn)                     5.22 kB         113 kB  (Hoàn toàn tĩnh)
+ First Load JS shared by all                103 kB
```

### Các hạng mục kỹ thuật đã triển khai

1. **Vùng máy chủ (Serverless Region):**
   - Tạo file `vercel.json` cấu hình `"regions": ["sin1"]` (Singapore).
   - Yêu cầu Supabase project đặt tại Singapore (`ap-southeast-1`) để tối ưu hóa RTT mạng giữa Next.js Serverless Functions và PostgreSQL.

2. **Bộ nhớ đệm (Caching & Invalidation):**
   - Trang `/` biên dịch tĩnh (`force-static`).
   - Hàm `getCachedTodayMenu()` trong `lib/menu-cache.ts` sử dụng `unstable_cache` với tag `'menu'`.
   - Server Action *Công bố thực đơn* (`publishDailyMenu`) gọi `revalidateTag('menu')` để xóa đệm ngay khi cập nhật thực đơn mới.
   - Các lượt truy cập `/menu` hay gọi API `/api/menu/today` đọc trực tiếp từ cache, loại bỏ hoàn toàn việc truy vấn DB liên tục.

3. **Tối ưu hình ảnh (`next/image`):**
   - Chuyển đổi 100% thẻ `<img>` thô sang `next/image` trên toàn bộ trang chủ, thực đơn, bộ tùy chỉnh món ăn, giỏ hàng, tem nhãn và trang thanh toán.
   - Khai báo đầy đủ `sizes` responsive, bật `priority` và `fetchPriority="high"` cho ảnh đĩa hero trên nếp gấp màn hình (above-the-fold).
   - Thiết lập `loading="lazy"` cho tất cả hình ảnh phụ bên dưới và thumbnail carousel.
   - Cấu hình định dạng AVIF/WebP cùng `remotePatterns` bảo mật trong `next.config.ts`.

4. **Tối ưu phông chữ (`next/font`):**
   - Tích hợp `next/font/google` cho phông chữ chủ đạo `Be_Vietnam_Pro`, `Playfair_Display` và `JetBrains_Mono` với `display: "swap"`.
   - Xóa bỏ hoàn toàn thẻ `@import` Google Fonts từ CSS bên ngoài, loại bỏ chặn hiển thị (render-blocking) tài nguyên.

5. **Chỉ mục cơ sở dữ liệu & Tối ưu truy vấn (Migration 003):**
   - Khởi tạo các index chuyên dụng: `orders(status, created_at DESC)`, `orders(public_token)`, `orders(public_code)`, `order_items(order_id)`, `menu_dishes(menu_day_id)`, `combos(menu_day_id)`, `combo_items(combo_id)`.
   - Tinh chỉnh truy vấn trong `lib/orders-db.ts`: chỉ select các cột dữ liệu cần thiết, gom các truy vấn độc lập bằng `Promise.all` và triệt tiêu vấn đề N+1 queries.

6. **Giảm kích thước Bundle (Code Splitting):**
   - Chuyển thư viện `qrcode` sang Dynamic Import trong API route `/api/qr`.
   - Lazy load các thành phần giao diện chỉ sử dụng ở khu vực Admin (`DishForm`, `OrderManagement`, `CookingOps`...) bằng `next/dynamic`.

7. **Giám sát hiệu năng thực tế (Real-User Monitoring):**
   - Nhúng component `<SpeedInsights />` từ thư viện `@vercel/speed-insights/next` vào `app/layout.tsx`.


