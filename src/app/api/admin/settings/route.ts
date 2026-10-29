import type { NextRequest } from "next/server";
import { adminRoute } from "@/lib/admin";
import { getRepo } from "@/lib/db";
import type { StoreSettings } from "@/lib/types";

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
  if (typeof raw.is_open === "boolean") patch.is_open = raw.is_open;
  number("store_lat", -90, 90);
  number("store_lng", -180, 180);
  number("max_delivery_km", 0, 100);
  number("shipping_fee_per_km", 0, 1_000_000);
  if (patch.shipping_fee_per_km !== undefined) {
    patch.shipping_fee_per_km = Math.round(patch.shipping_fee_per_km);
  }
  if (typeof raw.admin_pin === "string" && raw.admin_pin.trim()) {
    const pin = raw.admin_pin.trim();
    if (!/^\d{4,12}$/.test(pin)) throw new Error("PIN phải gồm 4–12 chữ số.");
    patch.admin_pin = pin;
  }

  const settings = await getRepo().updateSettings(patch);
  return Response.json({ settings });
});
