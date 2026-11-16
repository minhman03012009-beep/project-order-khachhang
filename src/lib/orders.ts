import "server-only";
import { randomBytes } from "node:crypto";
import { getRepo } from "./db";
import {
  evaluateOrderRisk,
  getVietnamHourDecimal,
  hasDangerousKeys,
  isVirtualPhonePrefix,
  sanitizeCustomerText,
} from "./security";
import type {
  CreateOrderInput,
  MenuResponse,
  Order,
  OrderItem,
  PaymentMethod,
  PublicSettings,
  StoreSettings,
} from "./types";
import {
  computeShippingFee,
  DELIVERY_QUICK_TAGS,
  haversineKm,
  isValidPhone,
  ITEM_QUICK_TAGS,
  SPICY_OPTIONS,
} from "./utils";

export function toPublicSettings(s: StoreSettings): PublicSettings {
  const {
    telegram_bot_token: _t,
    telegram_chat_id: _c,
    admin_pin: _p,
    bank_webhook_secret: _bw,
    telegram_webhook_secret: _tw,
    blacklisted_phones: _bl,
    ...pub
  } = s;
  void _t;
  void _c;
  void _p;
  void _bw;
  void _tw;
  void _bl;
  return {
    ...pub,
    vouchers: (pub.vouchers ?? []).filter((v) => v.is_active),
  };
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

const finite = (v: unknown): number | null =>
  typeof v === "number" && Number.isFinite(v) ? v : null;

const ALLOWED_ITEM_TAGS = new Set<string>(ITEM_QUICK_TAGS);
const ALLOWED_DELIVERY_TAGS = new Set<string>(DELIVERY_QUICK_TAGS);
const ALLOWED_SPICY_LEVELS = new Set<number>(SPICY_OPTIONS.map((s) => s.level));

/**
 * Validates the payload with Zero-Trust rules and recomputes every price,
 * shipping fee, voucher, discount and risk score server-side.
 */
export async function placeOrder(
  input: CreateOrderInput,
): Promise<{ order: Order; customerOrderCount: number | null; settings: StoreSettings }> {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new HttpError(400, "Dữ liệu đặt hàng không hợp lệ.");
  }
  if (hasDangerousKeys(input)) {
    throw new HttpError(400, "Phát hiện dữ liệu không hợp lệ (Zero-Trust Guard).");
  }
  if (typeof input.honeypot === "string" && input.honeypot.trim().length > 0) {
    throw new HttpError(400, "Không thể xác nhận yêu cầu tự động.");
  }

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
  const isSelfPickup = orderType === "DINE_IN" && Boolean(input.is_self_pickup);
  const name = sanitizeCustomerText(input.customer_name, 80);
  const phone = sanitizeCustomerText(input.customer_phone, 15).replace(/\s+/g, "");
  const tableNumber = sanitizeCustomerText(input.table_number, 40);

  if (phone && (!isValidPhone(phone) || isVirtualPhonePrefix(phone))) {
    throw new HttpError(400, "Số điện thoại không hợp lệ (cần 10 số Việt Nam).");
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
      throw new HttpError(
        409,
        `Món "${product?.name ?? "không xác định"}" vừa hết. Vui lòng cập nhật giỏ hàng.`,
      );
    }
    const quantity = Math.min(50, Math.max(1, Math.floor(Number(raw.quantity) || 1)));
    const spicyLevel =
      settings.enable_spicy_level &&
      raw.spicyLevel != null &&
      ALLOWED_SPICY_LEVELS.has(Number(raw.spicyLevel))
        ? Number(raw.spicyLevel)
        : null;

    // Deduplicate topping ids per item
    const seenTops = new Set<string>();
    const selectedToppings = (Array.isArray(raw.toppings) ? raw.toppings : [])
      .filter((t) => {
        if (!t || typeof t.id !== "string" || seenTops.has(t.id)) return false;
        seenTops.add(t.id);
        return true;
      })
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
      spicyLevel,
      selectedToppings,
      quickTags: (Array.isArray(raw.quickTags) ? raw.quickTags : []).filter((t) =>
        ALLOWED_ITEM_TAGS.has(t),
      ),
      itemNote: sanitizeCustomerText(raw.itemNote, 200),
      subtotal: unit * quantity,
    };
  });

  const itemsSum = items.reduce((s, it) => s + it.subtotal, 0);
  const totalBoxes = items.reduce((s, it) => s + it.quantity, 0);

  // ---------- delivery & shipping ----------
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
    address = sanitizeCustomerText(input.delivery_address, 300);

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
    // Apply freeship threshold if configured and within delivery radius
    if (
      settings.freeship_threshold > 0 &&
      itemsSum >= settings.freeship_threshold &&
      (distance == null || distance <= Math.max(3, settings.max_delivery_km))
    ) {
      shippingFee = 0;
    }
  } else if (!name && !tableNumber && !isSelfPickup) {
    throw new HttpError(400, "Vui lòng nhập số bàn hoặc tên của bạn.");
  }

  // ---------- discounts & vouchers (server-computed) ----------
  let discountAmount = 0;
  const appliedLabels: string[] = [];

  if (isSelfPickup && settings.self_pickup_discount_pct > 0) {
    const pct = Math.min(50, Math.max(0, settings.self_pickup_discount_pct));
    const pickupDisc = Math.round((itemsSum * pct) / 100);
    if (pickupDisc > 0) {
      discountAmount += pickupDisc;
      appliedLabels.push(`Mang đi -${pct}%`);
    }
  }

  const rawVoucher = sanitizeCustomerText(input.voucher_code, 30).toUpperCase();
  let matchedVoucherCode = "";
  if (rawVoucher) {
    const v = (settings.vouchers ?? []).find(
      (rule) => rule.is_active && rule.code.toUpperCase() === rawVoucher,
    );
    if (!v) {
      throw new HttpError(400, `Mã ưu đãi "${rawVoucher}" không tồn tại hoặc đã hết hạn.`);
    }
    if (itemsSum < v.min_order_amount) {
      throw new HttpError(
        400,
        `Mã "${v.code}" áp dụng cho đơn từ ${v.min_order_amount.toLocaleString("vi-VN")}đ.`,
      );
    }
    discountAmount += Math.max(0, Math.round(v.discount_amount));
    matchedVoucherCode = v.code;
    appliedLabels.push(v.code);
  }

  const totalAmount = Math.max(0, itemsSum + shippingFee - discountAmount);

  // ---------- Zero-Trust Risk Scoring ----------
  const isBlacklisted = Boolean(
    existing?.is_blacklisted ||
      (phone && (settings.blacklisted_phones ?? []).includes(phone)),
  );
  const risk = evaluateOrderRisk({
    orderType,
    phone,
    completedOrdersCount: existing?.total_orders ?? 0,
    isBlacklisted,
    totalAmount,
    totalBoxes,
    distanceKm: distance,
    orderHourVietnam: getVietnamHourDecimal(),
    formDurationMs: finite(input.form_duration_ms) ?? undefined,
  });

  let paymentMethod: PaymentMethod = input.payment_method === "VIETQR" ? "VIETQR" : "CASH";
  if (settings.force_vietqr_high_risk && risk.requirePrepaidVietQr && paymentMethod === "CASH") {
    paymentMethod = "VIETQR";
  }

  const quickNotes = (Array.isArray(input.quick_notes) ? input.quick_notes : []).filter((n) =>
    orderType === "DELIVERY" ? ALLOWED_DELIVERY_TAGS.has(n) : false,
  );

  const preferred = sanitizeCustomerText(input.preferred_code, 20);
  const trackingToken = randomBytes(16).toString("hex");
  const expiresAt =
    paymentMethod === "VIETQR"
      ? new Date(Date.now() + 15 * 60 * 1000).toISOString()
      : null;

  const order = await repo.createOrder({
    order_code: /^#IND-\d{3,}$/.test(preferred) ? preferred : undefined,
    order_type: orderType,
    table_number: orderType === "DINE_IN" ? (isSelfPickup ? "Mang đi" : tableNumber || null) : null,
    is_self_pickup: isSelfPickup,
    customer_name: name,
    customer_phone: phone,
    delivery_address: address,
    lat,
    lng,
    distance_km: distance,
    items,
    quick_notes: quickNotes,
    custom_note: sanitizeCustomerText(input.custom_note, 300),
    payment_method: paymentMethod,
    payment_status: "UNPAID",
    paid_amount: 0,
    shipping_fee: shippingFee,
    discount_amount: discountAmount,
    voucher_code: matchedVoucherCode || (appliedLabels[0] ?? ""),
    take_cutlery: input.take_cutlery !== false,
    scheduled_slot: orderType === "DELIVERY" ? sanitizeCustomerText(input.scheduled_slot, 60) : "",
    risk_score: risk.riskScore,
    trust_label: risk.trustLabel,
    require_call_alert: risk.requireCallAlert,
    tracking_token: trackingToken,
    expires_at: expiresAt,
    updated_by: "",
    total_amount: totalAmount,
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
      is_blacklisted: existing?.is_blacklisted ?? false,
      notes: existing?.notes ?? "",
      updated_at: new Date().toISOString(),
    });
  }

  return { order, customerOrderCount, settings };
}
