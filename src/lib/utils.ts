import type { OrderItem, PublicSettings } from "./types";

export const ITEM_QUICK_TAGS = [
  "Không hành",
  "Ít cay",
  "Thêm cay",
  "Để sốt riêng",
  "Trứng chín kỹ",
  "Trứng lòng đào",
] as const;

export const DELIVERY_QUICK_TAGS = [
  "Gọi trước khi giao",
  "Tới nơi nhắn tin, đừng bấm chuông",
  "Giao càng sớm càng tốt",
] as const;

export const STATUS_LABEL: Record<string, string> = {
  PENDING: "Chờ xác nhận",
  COOKING: "Đang nấu",
  DELIVERING: "Đang giao",
  COMPLETED: "Hoàn tất",
  CANCELLED: "Đã hủy",
};

/** 25000 -> "25.000đ" */
export function formatVND(value: number): string {
  return `${Math.round(value).toLocaleString("vi-VN")}đ`;
}

/** Great-circle distance in km (Haversine, R = 6371 km). */
export function haversineKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6371;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dPhi = toRad(lat2 - lat1);
  const dLambda = toRad(lng2 - lng1);
  const a =
    Math.sin(dPhi / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLambda / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Delivery fee: shipping_fee_per_km × ceil(distance).
 * When GPS is unknown we charge 1 km as an estimate.
 */
export function computeShippingFee(
  feePerKm: number,
  distanceKm: number | null,
): number {
  if (feePerKm <= 0) return 0;
  const km = distanceKm == null ? 1 : Math.max(1, Math.ceil(distanceKm));
  return km * feePerKm;
}

/** "123 Nguyễn Trãi, Q1" -> "123 Ng***" */
export function maskAddress(address: string): string {
  const trimmed = address.trim();
  if (trimmed.length <= 6) return `${trimmed.slice(0, 2)}***`;
  return `${trimmed.slice(0, Math.min(8, Math.ceil(trimmed.length / 3)))}***...`;
}

export function isValidPhone(phone: string): boolean {
  return /^0\d{9}$/.test(phone.trim());
}

/** "#IND-042" -> "IND042" (safe for bank transfer memo). */
export function transferMemo(orderCode: string): string {
  return `INDOMIE ${orderCode.replace(/[^A-Za-z0-9]/g, "")}`;
}

export function buildVietQrUrl(
  settings: Pick<
    PublicSettings,
    "bank_id" | "bank_account_no" | "bank_account_name"
  >,
  amount: number,
  orderCode: string,
): string | null {
  if (!settings.bank_id || !settings.bank_account_no) return null;
  const params = new URLSearchParams({
    amount: String(Math.round(amount)),
    addInfo: transferMemo(orderCode),
    accountName: settings.bank_account_name,
  });
  return `https://img.vietqr.io/image/${encodeURIComponent(
    settings.bank_id,
  )}-${encodeURIComponent(settings.bank_account_no)}-compact2.png?${params.toString()}`;
}

export function itemsTotal(items: Pick<OrderItem, "subtotal">[]): number {
  return items.reduce((sum, it) => sum + it.subtotal, 0);
}

export function cn(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(" ");
}
