import type { NextRequest } from "next/server";
import { adminRoute } from "@/lib/admin";
import { getRepo } from "@/lib/db";
import { isValidHexColor } from "@/lib/theme";
import type { StoreSettings, VoucherRule } from "@/lib/types";

export const GET = adminRoute(async () => {
  const settings = await getRepo().getSettings();
  return Response.json({ settings, storage: getRepo().kind });
});

export const PUT = adminRoute(async (req: NextRequest) => {
  const raw = (await req.json()) as Partial<StoreSettings>;
  const patch: Partial<StoreSettings> = {};

  const text = (k: keyof StoreSettings, max = 200) => {
    if (typeof raw[k] === "string") {
      (patch as Record<string, unknown>)[k] = (raw[k] as string).trim().slice(0, max);
    }
  };
  const bool = (k: keyof StoreSettings) => {
    if (typeof raw[k] === "boolean") {
      (patch as Record<string, unknown>)[k] = raw[k];
    }
  };
  const number = (k: keyof StoreSettings, min = -Infinity, max = Infinity) => {
    if (raw[k] !== undefined && raw[k] !== null && raw[k] !== "") {
      const n = Number(raw[k]);
      if (!Number.isFinite(n)) throw new Error(`Giá trị ${k} không hợp lệ`);
      (patch as Record<string, unknown>)[k] = Math.min(max, Math.max(min, n));
    }
  };

  text("store_name", 80);
  text("bank_id", 20);
  text("bank_account_no", 30);
  text("bank_account_name", 80);
  text("telegram_bot_token", 120);
  text("telegram_chat_id", 40);
  text("bank_webhook_secret", 120);
  text("telegram_webhook_secret", 120);

  // Theme & White-label branding
  text("theme_preset", 40);
  if (raw.theme_mode === "dark" || raw.theme_mode === "light") {
    patch.theme_mode = raw.theme_mode;
  }
  if (typeof raw.theme_bg_color === "string" && isValidHexColor(raw.theme_bg_color)) {
    patch.theme_bg_color = raw.theme_bg_color.trim();
  }
  if (typeof raw.theme_accent_color === "string" && isValidHexColor(raw.theme_accent_color)) {
    patch.theme_accent_color = raw.theme_accent_color.trim();
  }
  bool("allow_customer_theme_toggle");
  text("menu_title", 80);
  text("item_unit_label", 20);
  text("hotline", 25);
  text("store_address", 200);
  text("store_hours", 80);

  // Store operations & UX toggles
  bool("is_open");
  bool("enable_spicy_level");
  bool("enable_cutlery_option");
  bool("force_vietqr_high_risk");
  bool("customer_cancel_enabled");

  number("store_lat", -90, 90);
  number("store_lng", -180, 180);
  number("max_delivery_km", 0, 100);
  number("shipping_fee_per_km", 0, 1_000_000);
  number("freeship_threshold", 0, 5_000_000);
  number("self_pickup_discount_pct", 0, 50);

  if (patch.shipping_fee_per_km !== undefined) {
    patch.shipping_fee_per_km = Math.round(patch.shipping_fee_per_km);
  }
  if (patch.freeship_threshold !== undefined) {
    patch.freeship_threshold = Math.round(patch.freeship_threshold);
  }
  if (patch.self_pickup_discount_pct !== undefined) {
    patch.self_pickup_discount_pct = Math.round(patch.self_pickup_discount_pct);
  }

  if (Array.isArray(raw.vouchers)) {
    patch.vouchers = raw.vouchers
      .filter((v): v is VoucherRule => Boolean(v && typeof v.code === "string" && v.code.trim()))
      .slice(0, 20)
      .map((v) => ({
        code: v.code.trim().toUpperCase().replace(/[^A-Z0-9_]/g, "").slice(0, 20),
        discount_amount: Math.max(0, Math.round(Number(v.discount_amount) || 0)),
        min_order_amount: Math.max(0, Math.round(Number(v.min_order_amount) || 0)),
        is_active: v.is_active !== false,
        description: String(v.description ?? "").trim().slice(0, 120),
      }))
      .filter((v) => v.code.length >= 3);
  }

  if (Array.isArray(raw.blacklisted_phones)) {
    patch.blacklisted_phones = Array.from(
      new Set(
        raw.blacklisted_phones
          .map((p) => String(p).replace(/\D/g, ""))
          .filter((p) => /^0\d{9}$/.test(p)),
      ),
    ).slice(0, 500);
  }

  if (typeof raw.admin_pin === "string" && raw.admin_pin.trim()) {
    const pin = raw.admin_pin.trim();
    if (!/^\d{4,12}$/.test(pin)) throw new Error("PIN phải gồm 4–12 chữ số.");
    patch.admin_pin = pin;
  }

  const settings = await getRepo().updateSettings(patch);
  return Response.json({ settings });
});
