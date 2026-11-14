-- Migration 004: Manual Payment Flow, Expiration, and Order Audit Events

-- 1. Bổ sung trường expires_at và cancel_reason cho bảng orders
alter table public.orders
  add column if not exists expires_at timestamptz,
  add column if not exists cancel_reason text;

-- 2. Tạo bảng order_events để ghi nhận lịch sử thay đổi trạng thái đơn
create table if not exists public.order_events (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  from_status text,
  to_status text not null,
  actor text not null default 'system', -- 'customer', 'admin', 'system'
  note text,
  created_at timestamptz not null default now()
);

-- 3. Bật RLS cho order_events (truy cập qua serverless service role)
alter table public.order_events enable row level security;

-- 4. Chỉ mục hiệu năng
create index if not exists idx_orders_expires_at on public.orders(status, expires_at);
create index if not exists idx_order_events_order_id on public.order_events(order_id);
create index if not exists idx_order_events_created_at on public.order_events(created_at desc);

