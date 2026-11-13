create type public.order_status as enum ('awaiting_payment', 'pending_verification', 'paid', 'cancelled');

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  public_token text unique not null,
  public_code text unique not null,
  customer_name text not null,
  phone text not null,
  customer_email text,
  delivery_address text not null,
  shipping_fee_vnd integer not null default 0,
  note text,
  status public.order_status not null default 'awaiting_payment',
  total_vnd integer not null check (total_vnd > 0),
  nutrition_snapshot jsonb not null,
  created_at timestamptz not null default now(),
  paid_at timestamptz
);

create table public.order_items (
  id bigint generated always as identity primary key,
  order_id uuid not null references public.orders(id) on delete cascade,
  dish_id text not null,
  name_snapshot text not null,
  unit_price_vnd integer not null,
  quantity integer not null check (quantity > 0),
  nutrition_snapshot jsonb not null
);

create table public.ingredients (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  kcal_per100 numeric(10,2) not null default 0 check (kcal_per100 >= 0),
  protein_per100 numeric(10,2) not null default 0 check (protein_per100 >= 0),
  carbs_per100 numeric(10,2) not null default 0 check (carbs_per100 >= 0),
  fat_per100 numeric(10,2) not null default 0 check (fat_per100 >= 0),
  allergens text[] not null default '{}',
  usda_fdc_id text,
  source text not null default 'manual' check (source in ('manual', 'usda')),
  created_at timestamptz not null default now()
);

create table public.dishes (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  price_vnd integer not null check (price_vnd > 0),
  image_url text,
  yield_g numeric(10,2) not null check (yield_g > 0),
  approved boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.dish_ingredients (
  dish_id uuid not null references public.dishes(id) on delete cascade,
  ingredient_id uuid not null references public.ingredients(id) on delete restrict,
  raw_g numeric(10,2) not null check (raw_g > 0),
  primary key (dish_id, ingredient_id)
);

create type public.combo_goal as enum ('balanced', 'light', 'protein');

create table public.menu_days (
  id uuid primary key default gen_random_uuid(),
  menu_date date not null unique,
  published boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.menu_dishes (
  menu_day_id uuid not null references public.menu_days(id) on delete cascade,
  dish_id uuid not null references public.dishes(id) on delete restrict,
  portion_limit integer not null check (portion_limit > 0),
  step_g numeric(10,2) not null check (step_g > 0),
  min_g numeric(10,2) not null check (min_g > 0),
  max_g numeric(10,2) not null check (max_g >= min_g),
  primary key (menu_day_id, dish_id)
);

create table public.combos (
  id uuid primary key default gen_random_uuid(),
  menu_day_id uuid not null references public.menu_days(id) on delete cascade,
  goal public.combo_goal not null,
  unique (menu_day_id, goal)
);

create table public.combo_items (
  combo_id uuid not null references public.combos(id) on delete cascade,
  dish_id uuid not null references public.dishes(id) on delete restrict,
  grams numeric(10,2) not null check (grams > 0),
  primary key (combo_id, dish_id)
);

alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.ingredients enable row level security;
alter table public.dishes enable row level security;
alter table public.dish_ingredients enable row level security;
alter table public.menu_days enable row level security;
alter table public.menu_dishes enable row level security;
alter table public.combos enable row level security;
alter table public.combo_items enable row level security;
-- Browser clients use no direct table access. Route handlers use service role only.

-- Migration: ops workflow (cooking / packed / delivered)
-- 1. Extend order_status enum
alter type public.order_status add value if not exists 'cooking';
alter type public.order_status add value if not exists 'packed';
alter type public.order_status add value if not exists 'delivered';

-- 2. Add fields to orders table
alter table public.orders
  add column if not exists cooking_at timestamptz,
  add column if not exists packed_at timestamptz,
  add column if not exists delivered_at timestamptz;

-- 3. Table: cooking_batches (one batch per dish per cooking session)
create table if not exists public.cooking_batches (
  id uuid primary key default gen_random_uuid(),
  dish_id text not null,
  dish_name text not null,
  lot_code text not null unique,
  supplier_note text,
  cooked_yield_g numeric(10,2) not null check (cooked_yield_g > 0),
  cooked_at timestamptz not null default now(),
  created_by text not null default 'admin'
);
alter table public.cooking_batches enable row level security;

-- 4. Table: nutrition_snapshots (one per order_item once packed)
-- Payload: immutable after creation.
create table if not exists public.nutrition_snapshots (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  order_item_id bigint not null,
  qr_code text not null unique,  -- e.g. MHLN4358-GA-001
  dish_name text not null,
  cooked_at date not null,
  cooked_batch_id uuid references public.cooking_batches(id),
  actual_grams numeric(10,2) not null check (actual_grams > 0),
  kcal numeric(10,2) not null,
  protein_g numeric(10,2) not null,
  carbs_g numeric(10,2) not null,
  fat_g numeric(10,2) not null,
  ingredients jsonb not null default '[]',   -- [{name, raw_g, allergens:[]}]
  allergens text[] not null default '{}',
  source_note text,
  lot_code text,
  packed_at timestamptz not null default now()
);
alter table public.nutrition_snapshots enable row level security;

-- Row Level Security (RLS) policies for anon (public read-only)
-- Only approved dishes and published menus/combos are visible to anon.
-- All other tables (orders, order_items, ingredients, cooking_batches, nutrition_snapshots)
-- have NO policy for anon and can only be accessed via server service role.
drop policy if exists "anon_select_approved_dishes" on public.dishes;
create policy "anon_select_approved_dishes"
  on public.dishes
  for select
  to anon
  using (approved = true);

drop policy if exists "anon_select_published_menu_days" on public.menu_days;
create policy "anon_select_published_menu_days"
  on public.menu_days
  for select
  to anon
  using (published = true);

drop policy if exists "anon_select_published_menu_dishes" on public.menu_dishes;
create policy "anon_select_published_menu_dishes"
  on public.menu_dishes
  for select
  to anon
  using (
    exists (
      select 1 from public.menu_days
      where public.menu_days.id = public.menu_dishes.menu_day_id
        and public.menu_days.published = true
    )
  );

drop policy if exists "anon_select_published_combos" on public.combos;
create policy "anon_select_published_combos"
  on public.combos
  for select
  to anon
  using (
    exists (
      select 1 from public.menu_days
      where public.menu_days.id = public.combos.menu_day_id
        and public.menu_days.published = true
    )
  );

drop policy if exists "anon_select_published_combo_items" on public.combo_items;
create policy "anon_select_published_combo_items"
  on public.combo_items
  for select
  to anon
  using (
    exists (
      select 1 from public.combos
      join public.menu_days on public.menu_days.id = public.combos.menu_day_id
      where public.combos.id = public.combo_items.combo_id
        and public.menu_days.published = true
    )
  );
