import { OrderApp } from "@/components/order/OrderApp";
import { SEED_PRODUCTS, SEED_SETTINGS, SEED_TOPPINGS } from "@/lib/db/seed";
import type { MenuResponse } from "@/lib/types";

const INITIAL_MENU: MenuResponse = {
  settings: {
    id: SEED_SETTINGS.id,
    store_name: SEED_SETTINGS.store_name,
    is_open: SEED_SETTINGS.is_open,
    store_lat: SEED_SETTINGS.store_lat,
    store_lng: SEED_SETTINGS.store_lng,
    max_delivery_km: SEED_SETTINGS.max_delivery_km,
    shipping_fee_per_km: SEED_SETTINGS.shipping_fee_per_km,
    bank_id: SEED_SETTINGS.bank_id,
    bank_account_no: SEED_SETTINGS.bank_account_no,
    bank_account_name: SEED_SETTINGS.bank_account_name,
    theme_preset: SEED_SETTINGS.theme_preset,
    theme_mode: SEED_SETTINGS.theme_mode,
    theme_bg_color: SEED_SETTINGS.theme_bg_color,
    theme_accent_color: SEED_SETTINGS.theme_accent_color,
    allow_customer_theme_toggle: SEED_SETTINGS.allow_customer_theme_toggle,
    menu_title: SEED_SETTINGS.menu_title,
    item_unit_label: SEED_SETTINGS.item_unit_label,
    hotline: SEED_SETTINGS.hotline,
    store_address: SEED_SETTINGS.store_address,
    store_hours: SEED_SETTINGS.store_hours,
    enable_spicy_level: SEED_SETTINGS.enable_spicy_level,
    enable_cutlery_option: SEED_SETTINGS.enable_cutlery_option,
    freeship_threshold: SEED_SETTINGS.freeship_threshold,
    self_pickup_discount_pct: SEED_SETTINGS.self_pickup_discount_pct,
    force_vietqr_high_risk: SEED_SETTINGS.force_vietqr_high_risk,
    customer_cancel_enabled: SEED_SETTINGS.customer_cancel_enabled,
    vouchers: SEED_SETTINGS.vouchers,
  },
  products: SEED_PRODUCTS,
  toppings: SEED_TOPPINGS,
};

export default function HomePage() {
  return <OrderApp initialMenu={INITIAL_MENU} />;
}
