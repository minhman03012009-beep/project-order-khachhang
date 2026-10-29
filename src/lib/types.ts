// ============================================================
// Domain types — mirror supabase/schema.sql 1:1
// ============================================================

export type OrderType = "DINE_IN" | "DELIVERY";
export type PaymentMethod = "CASH" | "VIETQR";
export type OrderStatus =
  | "PENDING"
  | "COOKING"
  | "DELIVERING"
  | "COMPLETED"
  | "CANCELLED";

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
}

/** Settings safe to expose to anonymous customers (no secrets). */
export type PublicSettings = Omit<
  StoreSettings,
  "telegram_bot_token" | "telegram_chat_id" | "admin_pin"
>;

export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
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

export interface Customer {
  phone: string;
  name: string;
  address: string;
  lat: number | null;
  lng: number | null;
  total_orders: number;
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
  shipping_fee: number;
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
  toppings: { id: string; quantity: number }[];
  quickTags: string[];
  itemNote: string;
}

export interface CreateOrderInput {
  order_type: OrderType;
  table_number?: string;
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
}

export interface CustomerLookupResponse {
  found: boolean;
  name?: string;
  masked_address?: string;
  has_address?: boolean;
  has_location?: boolean;
  total_orders?: number;
}
