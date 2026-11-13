-- Migration 003: Strict Row Level Security policies
-- 1. Ensure RLS is enabled on ALL tables
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.ingredients enable row level security;
alter table public.dishes enable row level security;
alter table public.dish_ingredients enable row level security;
alter table public.menu_days enable row level security;
alter table public.menu_dishes enable row level security;
alter table public.combos enable row level security;
alter table public.combo_items enable row level security;
alter table public.cooking_batches enable row level security;
alter table public.nutrition_snapshots enable row level security;

-- 2. Drop any legacy/unintended anon policies
drop policy if exists "anon_select_approved_dishes" on public.dishes;
drop policy if exists "anon_select_published_menu_days" on public.menu_days;
drop policy if exists "anon_select_published_menu_dishes" on public.menu_dishes;
drop policy if exists "anon_select_published_combos" on public.combos;
drop policy if exists "anon_select_published_combo_items" on public.combo_items;

-- 3. Only allow anon to SELECT approved dishes and published menus/combos
create policy "anon_select_approved_dishes"
  on public.dishes
  for select
  to anon
  using (approved = true);

create policy "anon_select_published_menu_days"
  on public.menu_days
  for select
  to anon
  using (published = true);

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

