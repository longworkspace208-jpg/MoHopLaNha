-- Migration 003: Chỉ mục hiệu năng cho database (Performance Indexes)

-- 1. Orders: Tìm kiếm và lọc theo status + created_at
CREATE INDEX IF NOT EXISTS idx_orders_status_created_at ON public.orders(status, created_at DESC);

-- 2. Orders: Tra cứu theo public_token không đoán được
CREATE INDEX IF NOT EXISTS idx_orders_public_token ON public.orders(public_token);

-- 3. Orders: Tra cứu theo mã đơn hàng công khai (public_code)
CREATE INDEX IF NOT EXISTS idx_orders_public_code ON public.orders(public_code);

-- 4. Order items: Truy vấn danh sách món ăn theo order_id (tránh N+1)
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON public.order_items(order_id);

-- 5. Menu items / Menu dishes: Truy vấn danh sách món theo menu_day_id
CREATE INDEX IF NOT EXISTS idx_menu_dishes_menu_day_id ON public.menu_dishes(menu_day_id);

-- 6. Combos: Truy vấn danh sách combo theo menu_day_id
CREATE INDEX IF NOT EXISTS idx_combos_menu_day_id ON public.combos(menu_day_id);

-- 7. Combo items: Truy vấn các món thuộc combo theo combo_id
CREATE INDEX IF NOT EXISTS idx_combo_items_combo_id ON public.combo_items(combo_id);

