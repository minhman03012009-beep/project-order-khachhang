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

/** Extracts an unknown column name from PostgREST / Postgres error messages. */
function extractMissingColumn(error: { message?: string; code?: string } | null): string | null {
  if (!error?.message) return null;
  const pgrst = /Could not find the '([^']+)' column/i.exec(error.message);
  if (pgrst) return pgrst[1];
  const pg = /column "([^"]+)" of relation "[^"]+" does not exist/i.exec(error.message);
  if (pg) return pg[1];
  return null;
}

/**
 * Retries a Supabase write if the remote table doesn't yet have newly added columns
 * (e.g. before the owner re-runs supabase/schema.sql migrations).
 */
async function resilientWrite<T>(
  payload: Record<string, unknown>,
  exec: (safePayload: Record<string, unknown>) => PromiseLike<{ data: T | null; error: { message: string; code?: string } | null }>,
  context: string,
): Promise<T> {
  const safe = { ...payload };
  for (let i = 0; i < 24; i++) {
    const { data, error } = await exec(safe);
    if (!error) return data as T;
    const missing = extractMissingColumn(error);
    if (missing && missing in safe) {
      console.warn(`[supabase] ${context}: column "${missing}" missing in DB; run supabase/schema.sql migration.`);
      delete safe[missing];
      continue;
    }
    fail(context, error);
  }
  throw new Error(`[supabase] ${context}: too many missing columns`);
}

function normalizeOrder(row: Record<string, unknown>): Order {
  return {
    ...(row as unknown as Order),
    lat: numOrNull(row.lat),
    lng: numOrNull(row.lng),
    distance_km: numOrNull(row.distance_km),
    shipping_fee: num(row.shipping_fee),
    discount_amount: num(row.discount_amount),
    paid_amount: num(row.paid_amount),
    risk_score: num(row.risk_score),
    total_amount: num(row.total_amount),
    quick_notes: (row.quick_notes as string[] | null) ?? [],
    custom_note: (row.custom_note as string | null) ?? "",
    items: (row.items as Order["items"]) ?? [],
    payment_status: (row.payment_status as Order["payment_status"]) ?? "UNPAID",
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
      const inserted = await resilientWrite<Record<string, unknown>>(
        SEED_SETTINGS as unknown as Record<string, unknown>,
        (p) => this.sb.from("store_settings").insert(p).select("*").single(),
        "seedSettings",
      );
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
      freeship_threshold: num(s.freeship_threshold),
      self_pickup_discount_pct: num(s.self_pickup_discount_pct),
      telegram_bot_token: s.telegram_bot_token ?? "",
      telegram_chat_id: s.telegram_chat_id ?? "",
      bank_webhook_secret: s.bank_webhook_secret ?? "",
      telegram_webhook_secret: s.telegram_webhook_secret ?? "",
      vouchers: Array.isArray(s.vouchers) ? s.vouchers : SEED_SETTINGS.vouchers,
      blacklisted_phones: Array.isArray(s.blacklisted_phones) ? s.blacklisted_phones : [],
    };
  }

  async updateSettings(patch: Partial<StoreSettings>): Promise<StoreSettings> {
    await this.getSettings(); // ensure row exists
    const { id: _ignored, ...rest } = patch;
    void _ignored;
    const data = await resilientWrite<Record<string, unknown>>(
      rest as Record<string, unknown>,
      (p) =>
        this.sb
          .from("store_settings")
          .update(p)
          .eq("id", SETTINGS_ID)
          .select("*")
          .single(),
      "updateSettings",
    );
    return this.normalizeSettings(data);
  }

  // ---------------- products ----------------
  async listProducts(): Promise<Product[]> {
    const { data, error } = await this.sb
      .from("products")
      .select("*")
      .order("sort_order", { ascending: true });
    if (error) fail("listProducts", error);
    return (data ?? []).map((p) => ({
      ...p,
      price: num(p.price),
      original_price: numOrNull(p.original_price),
    })) as Product[];
  }

  async upsertProduct(product: Product): Promise<Product> {
    const data = await resilientWrite<Product>(
      product as unknown as Record<string, unknown>,
      (p) => this.sb.from("products").upsert(p).select("*").single(),
      "upsertProduct",
    );
    return {
      ...data,
      price: num(data.price),
      original_price: numOrNull(data.original_price),
    };
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
  async listCustomers(limit = 200): Promise<Customer[]> {
    const { data, error } = await this.sb
      .from("customers")
      .select("*")
      .order("total_orders", { ascending: false })
      .limit(limit);
    if (error) fail("listCustomers", error);
    return (data ?? []).map((c) => ({
      ...(c as Customer),
      lat: numOrNull(c.lat),
      lng: numOrNull(c.lng),
      total_orders: num(c.total_orders),
    }));
  }

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
    const data = await resilientWrite<Customer>(
      customer as unknown as Record<string, unknown>,
      (p) =>
        this.sb
          .from("customers")
          .upsert(p, { onConflict: "phone" })
          .select("*")
          .single(),
      "upsertCustomer",
    );
    return data;
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

  async getOrderByCode(code: string): Promise<Order | null> {
    const digits = /(\d+)$/.exec(code)?.[1];
    const formatted = digits ? formatOrderCode(Number(digits)) : code;
    const { data, error } = await this.sb
      .from("orders")
      .select("*")
      .eq("order_code", formatted)
      .maybeSingle();
    if (error) fail("getOrderByCode", error);
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
      const payload = { ...input, order_code: code } as Record<string, unknown>;
      try {
        const data = await resilientWrite<Record<string, unknown>>(
          payload,
          (p) => this.sb.from("orders").insert(p).select("*").single(),
          "createOrder",
        );
        return normalizeOrder(data);
      } catch (e) {
        if (e instanceof Error && e.message.includes("23505")) {
          code = formatOrderCode(parseOrderSeq(await this.nextOrderCode()) + attempt);
          continue;
        }
        throw e;
      }
    }
    throw new Error("[supabase] createOrder: could not allocate order code");
  }

  async updateOrder(id: string, patch: Partial<Order>): Promise<Order | null> {
    const { id: _ignored, ...rest } = patch;
    void _ignored;
    const data = await resilientWrite<Record<string, unknown> | null>(
      rest as Record<string, unknown>,
      (p) =>
        this.sb
          .from("orders")
          .update(p)
          .eq("id", id)
          .select("*")
          .maybeSingle(),
      "updateOrder",
    );
    return data ? normalizeOrder(data) : null;
  }

  async updateOrderStatus(id: string, status: OrderStatus): Promise<Order | null> {
    return this.updateOrder(id, { status });
  }
}
