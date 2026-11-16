-- =====================================================================
-- Indomie QR & Remote Ordering — Supabase / PostgreSQL schema
-- Run in Supabase Dashboard → SQL Editor. Safe to re-run (idempotent).
-- =====================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------
-- 1. store_settings (single row)
-- ---------------------------------------------------------------------
create table if not exists public.store_settings (
  id                   uuid primary key default gen_random_uuid(),
  store_name           text    not null default 'Tiệm Mì Indomie',
  is_open              boolean not null default true,
  store_lat            float8  not null default 10.7769,
  store_lng            float8  not null default 106.7009,
  max_delivery_km      float8  not null default 5.0,
  shipping_fee_per_km  integer not null default 5000,
  bank_id              text    not null default 'MB',
  bank_account_no      text    not null default '',
  bank_account_name    text    not null default '',
  telegram_bot_token   text    not null default '',
  telegram_chat_id     text    not null default '',
  admin_pin            text    not null default '123456'
);

-- Commercial SaaS & Theme customization columns
alter table public.store_settings add column if not exists theme_preset text not null default 'obsidian';
alter table public.store_settings add column if not exists theme_mode text not null default 'dark';
alter table public.store_settings add column if not exists theme_bg_color text not null default '#050505';
alter table public.store_settings add column if not exists theme_accent_color text not null default '#ffffff';
alter table public.store_settings add column if not exists allow_customer_theme_toggle boolean not null default true;
alter table public.store_settings add column if not exists menu_title text not null default 'Thực đơn Mì Trộn';
alter table public.store_settings add column if not exists item_unit_label text not null default 'hộp';
alter table public.store_settings add column if not exists hotline text not null default '0327469961';
alter table public.store_settings add column if not exists store_address text not null default '';
alter table public.store_settings add column if not exists store_hours text not null default 'Mở cửa mỗi ngày';
alter table public.store_settings add column if not exists enable_spicy_level boolean not null default false;
alter table public.store_settings add column if not exists enable_cutlery_option boolean not null default true;
alter table public.store_settings add column if not exists freeship_threshold integer not null default 0;
alter table public.store_settings add column if not exists self_pickup_discount_pct integer not null default 0;
alter table public.store_settings add column if not exists force_vietqr_high_risk boolean not null default false;
alter table public.store_settings add column if not exists customer_cancel_enabled boolean not null default true;
alter table public.store_settings add column if not exists vouchers jsonb not null default '[]'::jsonb;
alter table public.store_settings add column if not exists bank_webhook_secret text not null default '';
alter table public.store_settings add column if not exists telegram_webhook_secret text not null default '';
alter table public.store_settings add column if not exists blacklisted_phones text[] not null default '{}';

-- ---------------------------------------------------------------------
-- 2. products
-- ---------------------------------------------------------------------
create table if not exists public.products (
  id            uuid primary key default gen_random_uuid(),
  name          text    not null,
  description   text    not null default '',
  price         integer not null check (price >= 0),
  image_url     text    not null default '',
  is_available  boolean not null default true,
  sort_order    integer not null default 0
);

alter table public.products add column if not exists original_price integer;
alter table public.products add column if not exists category text not null default 'Món chính';
alter table public.products add column if not exists badge_text text not null default '';

-- ---------------------------------------------------------------------
-- 3. toppings
-- ---------------------------------------------------------------------
create table if not exists public.toppings (
  id            uuid primary key default gen_random_uuid(),
  name          text    not null,
  price         integer not null check (price >= 0),
  image_url     text    not null default '',
  is_available  boolean not null default true,
  sort_order    integer not null default 0
);

-- ---------------------------------------------------------------------
-- 4. customers ("invisible" accounts keyed by phone)
-- ---------------------------------------------------------------------
create table if not exists public.customers (
  phone         text primary key,
  name          text        not null default '',
  address       text        not null default '',
  lat           float8,
  lng           float8,
  total_orders  integer     not null default 0,
  updated_at    timestamptz not null default now()
);

alter table public.customers add column if not exists is_blacklisted boolean not null default false;
alter table public.customers add column if not exists notes text not null default '';

-- ---------------------------------------------------------------------
-- 5. orders
-- ---------------------------------------------------------------------
create table if not exists public.orders (
  id                uuid primary key default gen_random_uuid(),
  order_code        text        not null unique,
  order_type        text        not null check (order_type in ('DINE_IN', 'DELIVERY')),
  table_number      text,
  customer_name     text        not null default '',
  customer_phone    text        not null default '',
  delivery_address  text,
  lat               float8,
  lng               float8,
  distance_km       float8,
  items             jsonb       not null default '[]'::jsonb,
  quick_notes       text[]      not null default '{}',
  custom_note       text        not null default '',
  payment_method    text        not null check (payment_method in ('CASH', 'VIETQR')),
  shipping_fee      integer     not null default 0,
  total_amount      integer     not null check (total_amount >= 0),
  status            text        not null default 'PENDING'
                    check (status in ('PENDING','COOKING','DELIVERING','COMPLETED','CANCELLED')),
  created_at        timestamptz not null default now()
);

alter table public.orders add column if not exists payment_status text not null default 'UNPAID';
alter table public.orders add column if not exists paid_amount integer not null default 0;
alter table public.orders add column if not exists discount_amount integer not null default 0;
alter table public.orders add column if not exists voucher_code text not null default '';
alter table public.orders add column if not exists take_cutlery boolean not null default true;
alter table public.orders add column if not exists scheduled_slot text not null default '';
alter table public.orders add column if not exists is_self_pickup boolean not null default false;
alter table public.orders add column if not exists risk_score integer not null default 0;
alter table public.orders add column if not exists trust_label text not null default 'KHÁCH MỚI';
alter table public.orders add column if not exists require_call_alert boolean not null default false;
alter table public.orders add column if not exists tracking_token text not null default '';
alter table public.orders add column if not exists expires_at timestamptz;
alter table public.orders add column if not exists updated_by text not null default '';

create index if not exists orders_created_at_idx on public.orders (created_at desc);
create index if not exists orders_status_idx     on public.orders (status);
create index if not exists orders_phone_idx      on public.orders (customer_phone);

-- =====================================================================
-- Row Level Security
-- =====================================================================
alter table public.store_settings enable row level security;
alter table public.products       enable row level security;
alter table public.toppings       enable row level security;
alter table public.customers      enable row level security;
alter table public.orders         enable row level security;

do $$
declare t text;
begin
  foreach t in array array['store_settings','products','toppings','customers','orders'] loop
    execute format('drop policy if exists "anon_all_%1$s" on public.%1$I', t);
    execute format(
      'create policy "anon_all_%1$s" on public.%1$I for all to anon using (true) with check (true)', t);
  end loop;
end $$;

-- =====================================================================
-- Seed data (same fixed IDs as src/lib/db/seed.ts)
-- =====================================================================
insert into public.store_settings
  (id, store_name, is_open, store_lat, store_lng, max_delivery_km, shipping_fee_per_km,
   bank_id, bank_account_no, bank_account_name, telegram_bot_token, telegram_chat_id, admin_pin)
values
  ('00000000-0000-0000-0000-000000000001', 'Tiệm Mì Indomie', true, 10.7769, 106.7009, 5.0, 5000,
   'MB', '0123456789', 'TIEM MI INDOMIE', '', '', '123456')
on conflict (id) do nothing;

insert into public.products (id, name, description, price, image_url, is_available, sort_order) values
  ('11111111-1111-4111-8111-000000000001', 'Mì Trộn Indomie Truyền Thống',
   'Sợi mì dai óng sốt xì dầu ngọt Indonesia, hành phi giòn rụm, hành lá & trứng ốp la.',
   25000, '/images/mi_truyen_thong.jpg', true, 1),
  ('11111111-1111-4111-8111-000000000002', 'Mì Trộn Indomie Đặc Biệt',
   'Full topping: trứng lòng đào, xúc xích nướng, chả cá Hàn Quốc, bò viên, mè rang.',
   39000, '/images/mi_dac_biet.jpg', true, 2),
  ('11111111-1111-4111-8111-000000000003', 'Mì Trộn Cay Hàn Quốc',
   'Sốt gochujang cay nồng, dầu ớt thơm, mè rang, ớt tươi và trứng ngâm tương.',
   32000, '/images/mi_cay_han_quoc.jpg', true, 3),
  ('11111111-1111-4111-8111-000000000004', 'Mì Trộn Phô Mai Kéo Sợi',
   'Mozzarella nướng chảy kéo sợi phủ kín mì trộn, trứng ốp la viền giòn.',
   35000, '/images/mi_pho_mai.jpg', true, 4)
on conflict (id) do nothing;

insert into public.toppings (id, name, price, image_url, is_available, sort_order) values
  ('22222222-2222-4222-8222-000000000001', 'Vắt mì Indomie thêm',       10000, '/images/tp_vat_mi.jpg',         true, 1),
  ('22222222-2222-4222-8222-000000000002', 'Trứng ốp la',                6000, '/images/tp_trung_op_la.jpg',    true, 2),
  ('22222222-2222-4222-8222-000000000003', 'Trứng lòng đào ngâm tương',  8000, '/images/tp_trung_long_dao.jpg', true, 3),
  ('22222222-2222-4222-8222-000000000004', 'Xúc xích khứa nướng',       10000, '/images/tp_xuc_xich.jpg',       true, 4),
  ('22222222-2222-4222-8222-000000000005', 'Chả cá Hàn Quốc',           10000, '/images/tp_cha_ca.jpg',         true, 5),
  ('22222222-2222-4222-8222-000000000006', 'Bò viên',                   10000, '/images/tp_bo_vien.jpg',        true, 6),
  ('22222222-2222-4222-8222-000000000007', 'Phô mai kéo sợi',           12000, '/images/tp_pho_mai.jpg',        true, 7),
  ('22222222-2222-4222-8222-000000000008', 'Kim chi cải thảo',           7000, '/images/tp_kim_chi.jpg',        true, 8)
on conflict (id) do nothing;
