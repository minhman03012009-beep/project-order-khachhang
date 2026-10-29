import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type {
  Customer,
  Order,
  OrderStatus,
  Product,
  StoreSettings,
  Topping,
} from "../types";
import {
  formatOrderCode,
  parseOrderSeq,
  type NewOrder,
  type Repository,
} from "./repository";
import { SEED_SETTINGS, SETTINGS_ID } from "./seed";

function fail(context: string, error: { message: string } | null): never {
  throw new Error(`[supabase] ${context}: ${error?.message ?? "unknown error"}`);
}

const num = (v: unknown, fallback = 0): number =>
  v === null || v === undefined || Number.isNaN(Number(v)) ? fallback : Number(v);
const numOrNull = (v: unknown): number | null =>
  v === null || v === undefined ? null : Number(v);

function normalizeOrder(row: Record<string, unknown>): Order {
  return {
    ...(row as unknown as Order),
    lat: numOrNull(row.lat),
    lng: numOrNull(row.lng),
    distance_km: numOrNull(row.distance_km),
    shipping_fee: num(row.shipping_fee),
    total_amount: num(row.total_amount),
    quick_notes: (row.quick_notes as string[] | null) ?? [],
    custom_note: (row.custom_note as string | null) ?? "",
    items: (row.items as Order["items"]) ?? [],
  };
}

export class SupabaseRepository implements Repository {
  readonly kind = "supabase" as const;
  private sb: SupabaseClient;

  constructor(url: string, key: string) {
    this.sb = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }

  // ---------------- settings ----------------
  async getSettings(): Promise<StoreSettings> {
    const { data, error } = await this.sb
      .from("store_settings")
      .select("*")
      .eq("id", SETTINGS_ID)
      .maybeSingle();
    if (error) fail("getSettings", error);
    if (!data) {
      const { data: inserted, error: insErr } = await this.sb
        .from("store_settings")
        .insert(SEED_SETTINGS)
        .select("*")
        .single();
      if (insErr) fail("seedSettings", insErr);
      return this.normalizeSettings(inserted);
    }
    return this.normalizeSettings(data);
  }

  private normalizeSettings(row: Record<string, unknown>): StoreSettings {
    const s = { ...SEED_SETTINGS, ...(row as Partial<StoreSettings>) };
    return {
      ...s,
      store_lat: num(s.store_lat),
      store_lng: num(s.store_lng),
      max_delivery_km: num(s.max_delivery_km),
      shipping_fee_per_km: num(s.shipping_fee_per_km),
      telegram_bot_token: s.telegram_bot_token ?? "",
      telegram_chat_id: s.telegram_chat_id ?? "",
    };
  }

  async updateSettings(patch: Partial<StoreSettings>): Promise<StoreSettings> {
    await this.getSettings(); // ensure row exists
    const { id: _ignored, ...rest } = patch;
    void _ignored;
    const { data, error } = await this.sb
      .from("store_settings")
      .update(rest)
      .eq("id", SETTINGS_ID)
      .select("*")
      .single();
    if (error) fail("updateSettings", error);
    return this.normalizeSettings(data);
  }

  // ---------------- products ----------------
  async listProducts(): Promise<Product[]> {
    const { data, error } = await this.sb
      .from("products")
      .select("*")
      .order("sort_order", { ascending: true });
    if (error) fail("listProducts", error);
    return (data ?? []).map((p) => ({ ...p, price: num(p.price) })) as Product[];
  }

  async upsertProduct(product: Product): Promise<Product> {
    const { data, error } = await this.sb
      .from("products")
      .upsert(product)
      .select("*")
      .single();
    if (error) fail("upsertProduct", error);
    return data as Product;
  }

  async deleteProduct(id: string): Promise<void> {
    const { error } = await this.sb.from("products").delete().eq("id", id);
    if (error) fail("deleteProduct", error);
  }

  // ---------------- toppings ----------------
  async listToppings(): Promise<Topping[]> {
    const { data, error } = await this.sb
      .from("toppings")
      .select("*")
      .order("sort_order", { ascending: true });
    if (error) fail("listToppings", error);
    return (data ?? []).map((t) => ({ ...t, price: num(t.price) })) as Topping[];
  }

  async upsertTopping(topping: Topping): Promise<Topping> {
    const { data, error } = await this.sb
      .from("toppings")
      .upsert(topping)
      .select("*")
      .single();
    if (error) fail("upsertTopping", error);
    return data as Topping;
  }

  async deleteTopping(id: string): Promise<void> {
    const { error } = await this.sb.from("toppings").delete().eq("id", id);
    if (error) fail("deleteTopping", error);
  }

  // ---------------- customers ----------------
  async getCustomer(phone: string): Promise<Customer | null> {
    const { data, error } = await this.sb
      .from("customers")
      .select("*")
      .eq("phone", phone)
      .maybeSingle();
    if (error) fail("getCustomer", error);
    if (!data) return null;
    return {
      ...(data as Customer),
      lat: numOrNull(data.lat),
      lng: numOrNull(data.lng),
      total_orders: num(data.total_orders),
    };
  }

  async upsertCustomer(customer: Customer): Promise<Customer> {
    const { data, error } = await this.sb
      .from("customers")
      .upsert(customer, { onConflict: "phone" })
      .select("*")
      .single();
    if (error) fail("upsertCustomer", error);
    return data as Customer;
  }

  // ---------------- orders ----------------
  async listOrders(limit = 100): Promise<Order[]> {
    const { data, error } = await this.sb
      .from("orders")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) fail("listOrders", error);
    return (data ?? []).map(normalizeOrder);
  }

  async getOrder(id: string): Promise<Order | null> {
    const { data, error } = await this.sb
      .from("orders")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) fail("getOrder", error);
    return data ? normalizeOrder(data) : null;
  }

  async nextOrderCode(): Promise<string> {
    const { data, error } = await this.sb
      .from("orders")
      .select("order_code")
      .order("created_at", { ascending: false })
      .limit(20);
    if (error) fail("nextOrderCode", error);
    const maxSeq = (data ?? []).reduce(
      (m, r) => Math.max(m, parseOrderSeq(String(r.order_code))),
      0,
    );
    return formatOrderCode(maxSeq + 1);
  }

  async isOrderCodeTaken(code: string): Promise<boolean> {
    const { count, error } = await this.sb
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("order_code", code);
    if (error) fail("isOrderCodeTaken", error);
    return (count ?? 0) > 0;
  }

  async createOrder(input: NewOrder): Promise<Order> {
    let code =
      input.order_code && !(await this.isOrderCodeTaken(input.order_code))
        ? input.order_code
        : await this.nextOrderCode();

    // order_code is UNIQUE — retry a few times on a race.
    for (let attempt = 0; attempt < 4; attempt++) {
      const { data, error } = await this.sb
        .from("orders")
        .insert({ ...input, order_code: code })
        .select("*")
        .single();
      if (!error) return normalizeOrder(data);
      if (error.code !== "23505") fail("createOrder", error);
      code = formatOrderCode(parseOrderSeq(await this.nextOrderCode()) + attempt);
    }
    throw new Error("[supabase] createOrder: could not allocate order code");
  }

  async updateOrderStatus(id: string, status: OrderStatus): Promise<Order | null> {
    const { data, error } = await this.sb
      .from("orders")
      .update({ status })
      .eq("id", id)
      .select("*")
      .maybeSingle();
    if (error) fail("updateOrderStatus", error);
    return data ? normalizeOrder(data) : null;
  }
}
