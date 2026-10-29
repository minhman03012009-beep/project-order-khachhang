import "server-only";
import { getRepo } from "./db";
import type {
  CreateOrderInput,
  MenuResponse,
  Order,
  OrderItem,
  PublicSettings,
  StoreSettings,
} from "./types";
import {
  computeShippingFee,
  DELIVERY_QUICK_TAGS,
  haversineKm,
  isValidPhone,
  ITEM_QUICK_TAGS,
} from "./utils";

export function toPublicSettings(s: StoreSettings): PublicSettings {
  const {
    telegram_bot_token: _t,
    telegram_chat_id: _c,
    admin_pin: _p,
    ...pub
  } = s;
  void _t;
  void _c;
  void _p;
  return pub;
}

/** Public menu payload (no secrets, only available toppings). */
export async function getMenu(): Promise<MenuResponse> {
  const repo = getRepo();
  const [settings, products, toppings] = await Promise.all([
    repo.getSettings(),
    repo.listProducts(),
    repo.listToppings(),
  ]);
  return {
    settings: toPublicSettings(settings),
    products,
    toppings: toppings.filter((t) => t.is_available),
  };
}

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

const str = (v: unknown, max: number): string =>
  typeof v === "string" ? v.trim().slice(0, max) : "";

const finite = (v: unknown): number | null =>
  typeof v === "number" && Number.isFinite(v) ? v : null;

const ALLOWED_ITEM_TAGS = new Set<string>(ITEM_QUICK_TAGS);
const ALLOWED_DELIVERY_TAGS = new Set<string>(DELIVERY_QUICK_TAGS);

/**
 * Validates the payload and recomputes every price server-side
 * (never trust totals coming from the browser).
 */
export async function placeOrder(
  input: CreateOrderInput,
): Promise<{ order: Order; customerOrderCount: number | null; settings: StoreSettings }> {
  const repo = getRepo();
  const [settings, products, toppings] = await Promise.all([
    repo.getSettings(),
    repo.listProducts(),
    repo.listToppings(),
  ]);

  if (!settings.is_open) {
    throw new HttpError(403, "Quán đang tạm ngưng nhận đơn. Bạn quay lại sau nhé!");
  }

  const orderType = input.order_type === "DELIVERY" ? "DELIVERY" : "DINE_IN";
  const name = str(input.customer_name, 80);
  const phone = str(input.customer_phone, 15).replace(/\s+/g, "");
  const tableNumber = str(input.table_number, 40);

  if (phone && !isValidPhone(phone)) {
    throw new HttpError(400, "Số điện thoại không hợp lệ (cần 10 số, bắt đầu bằng 0).");
  }

  // ---------- items ----------
  if (!Array.isArray(input.items) || input.items.length === 0) {
    throw new HttpError(400, "Giỏ hàng đang trống.");
  }
  if (input.items.length > 50) throw new HttpError(400, "Quá nhiều món trong một đơn.");

  const productMap = new Map(products.map((p) => [p.id, p]));
  const toppingMap = new Map(toppings.map((t) => [t.id, t]));

  const items: OrderItem[] = input.items.map((raw) => {
    const product = productMap.get(raw.productId);
    if (!product || !product.is_available) {
      throw new HttpError(409, `Món "${product?.name ?? "không xác định"}" vừa hết. Vui lòng cập nhật giỏ hàng.`);
    }
    const quantity = Math.min(50, Math.max(1, Math.floor(Number(raw.quantity) || 1)));
    const selectedToppings = (Array.isArray(raw.toppings) ? raw.toppings : [])
      .map((t) => {
        const top = toppingMap.get(t.id);
        if (!top || !top.is_available) {
          throw new HttpError(409, `Topping "${top?.name ?? "không xác định"}" vừa hết.`);
        }
        const q = Math.min(10, Math.max(0, Math.floor(Number(t.quantity) || 0)));
        return { id: top.id, name: top.name, price: top.price, quantity: q };
      })
      .filter((t) => t.quantity > 0);

    const unit =
      product.price + selectedToppings.reduce((s, t) => s + t.price * t.quantity, 0);
    return {
      productId: product.id,
      productName: product.name,
      basePrice: product.price,
      quantity,
      selectedToppings,
      quickTags: (Array.isArray(raw.quickTags) ? raw.quickTags : []).filter((t) =>
        ALLOWED_ITEM_TAGS.has(t),
      ),
      itemNote: str(raw.itemNote, 200),
      subtotal: unit * quantity,
    };
  });

  // ---------- delivery ----------
  let address: string | null = null;
  let lat: number | null = null;
  let lng: number | null = null;
  let distance: number | null = null;
  let shippingFee = 0;

  const existing = phone ? await repo.getCustomer(phone) : null;

  if (orderType === "DELIVERY") {
    if (!name) throw new HttpError(400, "Vui lòng nhập tên người nhận.");
    if (!phone) throw new HttpError(400, "Vui lòng nhập số điện thoại để shipper liên hệ.");

    lat = finite(input.lat);
    lng = finite(input.lng);
    address = str(input.delivery_address, 300);

    if (input.use_saved_address && existing?.address) {
      address = existing.address;
      if (lat == null && existing.lat != null && existing.lng != null) {
        lat = existing.lat;
        lng = existing.lng;
      }
    }
    if (!address) throw new HttpError(400, "Vui lòng nhập địa chỉ giao hàng.");

    if (lat != null && lng != null) {
      distance = Math.round(haversineKm(lat, lng, settings.store_lat, settings.store_lng) * 100) / 100;
      if (settings.max_delivery_km > 0 && distance > settings.max_delivery_km) {
        throw new HttpError(
          400,
          `Rất tiếc, bạn cách quán ~${distance.toFixed(1)} km, vượt bán kính giao hàng ${settings.max_delivery_km} km.`,
        );
      }
    } else {
      lat = null;
      lng = null;
    }
    shippingFee = computeShippingFee(settings.shipping_fee_per_km, distance);
  } else if (!name && !tableNumber) {
    throw new HttpError(400, "Vui lòng nhập số bàn hoặc tên của bạn.");
  }

  const itemsSum = items.reduce((s, it) => s + it.subtotal, 0);
  const quickNotes = (Array.isArray(input.quick_notes) ? input.quick_notes : []).filter((n) =>
    orderType === "DELIVERY" ? ALLOWED_DELIVERY_TAGS.has(n) : false,
  );

  const preferred = str(input.preferred_code, 20);
  const order = await repo.createOrder({
    order_code: /^#IND-\d{3,}$/.test(preferred) ? preferred : undefined,
    order_type: orderType,
    table_number: orderType === "DINE_IN" ? tableNumber || null : null,
    customer_name: name,
    customer_phone: phone,
    delivery_address: address,
    lat,
    lng,
    distance_km: distance,
    items,
    quick_notes: quickNotes,
    custom_note: str(input.custom_note, 300),
    payment_method: input.payment_method === "VIETQR" ? "VIETQR" : "CASH",
    shipping_fee: shippingFee,
    total_amount: itemsSum + shippingFee,
    status: "PENDING",
  });

  // ---------- invisible customer account ----------
  let customerOrderCount: number | null = null;
  if (phone) {
    const total = (existing?.total_orders ?? 0) + 1;
    customerOrderCount = total;
    await repo.upsertCustomer({
      phone,
      name: name || existing?.name || "",
      address: address ?? existing?.address ?? "",
      lat: lat ?? existing?.lat ?? null,
      lng: lng ?? existing?.lng ?? null,
      total_orders: total,
      updated_at: new Date().toISOString(),
    });
  }

  return { order, customerOrderCount, settings };
}
