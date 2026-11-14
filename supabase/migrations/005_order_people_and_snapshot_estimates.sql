-- Migration 005: Add people and goal to orders and nutrition_snapshots for reference

-- 1. Lưu số người ăn (people) và mục tiêu (goal) trên bảng orders (chỉ làm thông tin tham khảo)
alter table public.orders
  add column if not exists people integer default 1 check (people >= 1 and people <= 10),
  add column if not exists goal text;

-- 2. Thêm trường people và per_person_estimate vào nutrition_snapshots để lưu ước tính bình quân tham khảo
alter table public.nutrition_snapshots
  add column if not exists people integer default 1,
  add column if not exists per_person_estimate jsonb;
