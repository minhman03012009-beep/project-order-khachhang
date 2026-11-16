// ============================================================
// Domain types — mirror supabase/schema.sql 1:1 + Commercial SaaS extensions
// ============================================================

export type OrderType = "DINE_IN" | "DELIVERY";
export type PaymentMethod = "CASH" | "VIETQR";
export type PaymentStatus = "UNPAID" | "PARTIALLY_PAID" | "PAID";
export type TrustLabel = "KHÁCH QUEN" | "KHÁCH MỚI" | "RỦI RO CAO" | "BLACKLIST";
export type ThemeMode = "dark" | "light";
export type OrderStatus =
  | "PENDING"
  | "COOKING"
  | "DELIVERING"
  | "COMPLETED"
  | "CANCELLED";

export interface VoucherRule {
  code: string;
  discount_amount: number;
  min_order_amount: number;
  is_active: boolean;
  description: string;
}

export interface StoreSettings {
  id: string;
  store_name: string;
  is_open: boolean;
  store_lat: number;
  store_lng: number;
  max_delivery_km: number;
  shipping_fee_per_km: number;
  bank_id: string;
  bank_account_no: string;
  bank_account_name: string;
  telegram_bot_token: string;
  telegram_chat_id: string;
  admin_pin: string;

  // --- Theme & White-label Branding ---
  theme_preset: string;
  theme_mode: ThemeMode;
  theme_bg_color: string;
  theme_accent_color: string;
  allow_customer_theme_toggle: boolean;
  menu_title: string;
  item_unit_label: string;
  hotline: string;
  store_address: string;
  store_hours: string;

  // --- UX, Personalization & Commerce ---
  enable_spicy_level: boolean;
  enable_cutlery_option: boolean;
  freeship_threshold: number;
  self_pickup_discount_pct: number;
  force_vietqr_high_risk: boolean;
  customer_cancel_enabled: boolean;
  vouchers: VoucherRule[];

  // --- Zero-Trust Webhooks & Risk (Secrets) ---
  bank_webhook_secret: string;
  telegram_webhook_secret: string;
  blacklisted_phones: string[];
}

/** Settings safe to expose to anonymous customers (no secrets). */
export type PublicSettings = Omit<
  StoreSettings,
  | "telegram_bot_token"
  | "telegram_chat_id"
  | "admin_pin"
  | "bank_webhook_secret"
  | "telegram_webhook_secret"
  | "blacklisted_phones"
>;

export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  original_price?: number | null;
  category?: string;
  badge_text?: string;
  image_url: string;
  is_available: boolean;
  sort_order: number;
}

export interface Topping {
  id: string;
  name: string;
  price: number;
  image_url: string;
  is_available: boolean;
  sort_order: number;
}

export interface SavedAddressItem {
  id: string;
  label: string;
  address: string;
  lat: number | null;
  lng: number | null;
}

export interface Customer {
  phone: string;
  name: string;
  address: string;
  lat: number | null;
  lng: number | null;
  total_orders: number;
  is_blacklisted?: boolean;
  notes?: string;
  updated_at: string;
}

export interface OrderTopping {
  id: string;
  name: string;
  price: number;
  quantity: number;
}

export interface OrderItem {
  productId: string;
  productName: string;
  basePrice: number;
  quantity: number;
  spicyLevel?: number | null;
  selectedToppings: OrderTopping[];
  quickTags: string[];
  itemNote: string;
  subtotal: number;
}

export interface Order {
  id: string;
  order_code: string;
  order_type: OrderType;
  table_number: string | null;
  customer_name: string;
  customer_phone: string;
  delivery_address: string | null;
  lat: number | null;
  lng: number | null;
  distance_km: number | null;
  items: OrderItem[];
  quick_notes: string[];
  custom_note: string;
  payment_method: PaymentMethod;
  payment_status?: PaymentStatus;
  paid_amount?: number;
  shipping_fee: number;
  discount_amount?: number;
  voucher_code?: string;
  take_cutlery?: boolean;
  scheduled_slot?: string;
  is_self_pickup?: boolean;
  risk_score?: number;
  trust_label?: TrustLabel;
  require_call_alert?: boolean;
  tracking_token?: string;
  expires_at?: string | null;
  updated_by?: string;
  total_amount: number;
  status: OrderStatus;
  created_at: string;
}

// ------------------------------------------------------------
// API payloads
// ------------------------------------------------------------

export interface MenuResponse {
  settings: PublicSettings;
  products: Product[];
  toppings: Topping[];
}

export interface CreateOrderItemInput {
  productId: string;
  quantity: number;
  spicyLevel?: number | null;
  toppings: { id: string; quantity: number }[];
  quickTags: string[];
  itemNote: string;
}

export interface CreateOrderInput {
  order_type: OrderType;
  table_number?: string;
  is_self_pickup?: boolean;
  customer_name: string;
  customer_phone: string;
  delivery_address?: string;
  /** When true, server uses the address saved for this phone number. */
  use_saved_address?: boolean;
  lat?: number | null;
  lng?: number | null;
  items: CreateOrderItemInput[];
  quick_notes: string[];
  custom_note: string;
  payment_method: PaymentMethod;
  preferred_code?: string;
  voucher_code?: string;
  take_cutlery?: boolean;
  scheduled_slot?: string;
  /** Zero-Trust anti-bot signals */
  honeypot?: string;
  form_duration_ms?: number;
}

export interface CustomerLookupResponse {
  found: boolean;
  name?: string;
  masked_address?: string;
  has_address?: boolean;
  has_location?: boolean;
  total_orders?: number;
}
