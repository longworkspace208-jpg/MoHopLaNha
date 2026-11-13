-- Migration 002: Add public_token for customer-facing order routes
alter table public.orders add column if not exists public_token text;
update public.orders set public_token = gen_random_uuid()::text where public_token is null;
alter table public.orders alter column public_token set not null;
create unique index if not exists orders_public_token_idx on public.orders(public_token);
