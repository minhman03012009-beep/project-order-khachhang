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
  },
  products: SEED_PRODUCTS,
  toppings: SEED_TOPPINGS,
};

export default function HomePage() {
  return <OrderApp initialMenu={INITIAL_MENU} />;
}
