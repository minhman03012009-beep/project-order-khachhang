import "server-only";
import { randomUUID } from "node:crypto";
import { requireAdmin } from "./auth";
import type { Product, Topping } from "./types";

/** Wraps an admin route handler with auth + uniform error handling. */
export function adminRoute<Args extends unknown[]>(
  handler: (...args: Args) => Promise<Response>,
) {
  return async (...args: Args): Promise<Response> => {
    const denied = await requireAdmin();
    if (denied) return denied;
    try {
      return await handler(...args);
    } catch (e) {
      console.error("[admin]", e);
      const message = e instanceof Error ? e.message : "Lỗi không xác định";
      return Response.json({ error: message }, { status: 500 });
    }
  };
}

const MAX_IMAGE_LEN = 1_500_000; // ~1.1MB base64

function cleanImage(v: unknown): string {
  const s = typeof v === "string" ? v.trim() : "";
  if (s.length > MAX_IMAGE_LEN) throw new Error("Ảnh quá lớn (tối đa ~1MB).");
  if (s && !/^(https?:\/\/|\/|data:image\/)/.test(s)) {
    throw new Error("Link ảnh không hợp lệ.");
  }
  return s;
}

const int = (v: unknown, fallback = 0) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? n : fallback;
};

export function sanitizeProduct(raw: Partial<Product>, id?: string): Product {
  const name = String(raw.name ?? "").trim().slice(0, 120);
  if (!name) throw new Error("Tên món không được để trống.");
  return {
    id: id ?? raw.id ?? randomUUID(),
    name,
    description: String(raw.description ?? "").trim().slice(0, 400),
    price: Math.max(0, int(raw.price)),
    image_url: cleanImage(raw.image_url),
    is_available: raw.is_available !== false,
    sort_order: int(raw.sort_order, 0),
  };
}

export function sanitizeTopping(raw: Partial<Topping>, id?: string): Topping {
  const name = String(raw.name ?? "").trim().slice(0, 120);
  if (!name) throw new Error("Tên topping không được để trống.");
  return {
    id: id ?? raw.id ?? randomUUID(),
    name,
    price: Math.max(0, int(raw.price)),
    image_url: cleanImage(raw.image_url),
    is_available: raw.is_available !== false,
    sort_order: int(raw.sort_order, 0),
  };
}
