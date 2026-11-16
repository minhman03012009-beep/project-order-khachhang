import { timingSafeEqual } from "node:crypto";
import type { TrustLabel } from "./types";

const HTML_TAGS_RE = /<\/?[^>]+(>|$)/g;
const DANGEROUS_KEYS_RE = /^(__proto__|constructor|prototype|\$gt|\$ne|\$where|\$regex)$/i;
const VIRTUAL_PHONE_PREFIX_RE = /^(012|016|018|019|080|09900)/;

/** Normalizes Vietnamese Unicode (NFC), strips HTML tags, trims and truncates. */
export function sanitizeCustomerText(raw: unknown, maxLength = 200): string {
  if (typeof raw !== "string") return "";
  return raw.normalize("NFC").replace(HTML_TAGS_RE, "").trim().slice(0, maxLength);
}

/** Rejects Prototype Pollution / NoSQL Injection keys up to depth 5. */
export function hasDangerousKeys(obj: unknown, depth = 0): boolean {
  if (depth > 5 || obj === null || typeof obj !== "object") return false;
  for (const k of Object.keys(obj as Record<string, unknown>)) {
    if (DANGEROUS_KEYS_RE.test(k)) return true;
    const val = (obj as Record<string, unknown>)[k];
    if (val !== null && typeof val === "object" && hasDangerousKeys(val, depth + 1)) {
      return true;
    }
  }
  return false;
}

export function isVirtualPhonePrefix(phone: string): boolean {
  return VIRTUAL_PHONE_PREFIX_RE.test(phone.trim());
}

/** Masks phone number for public/group display: 0909123456 -> 0909.123.xxx */
export function maskPhoneNumber(phone: string): string {
  const clean = phone.replace(/\D/g, "");
  if (clean.length !== 10) return "0xxx.xxx.xxx";
  return `${clean.slice(0, 4)}.${clean.slice(4, 7)}.xxx`;
}

/** Constant-time string comparison for webhook secrets. */
export function timingSafeEqualStr(a: string, b: string): boolean {
  if (!a || !b) return false;
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

export interface OrderRiskInput {
  orderType: "DINE_IN" | "DELIVERY";
  phone: string;
  completedOrdersCount: number;
  isBlacklisted: boolean;
  totalAmount: number;
  totalBoxes: number;
  distanceKm: number | null;
  orderHourVietnam: number;
  formDurationMs?: number;
}

export interface OrderRiskResult {
  riskScore: number;
  trustLabel: TrustLabel;
  requirePrepaidVietQr: boolean;
  requireCallAlert: boolean;
  reasons: string[];
}

/**
 * Multi-layer Fraud & Risk Scoring Engine (0-100).
 * Adapted from mi-cay-zero-trust for Zero-Trust COD & anti-boom protection.
 */
export function evaluateOrderRisk(input: OrderRiskInput): OrderRiskResult {
  if (input.isBlacklisted) {
    return {
      riskScore: 100,
      trustLabel: "BLACKLIST",
      requirePrepaidVietQr: true,
      requireCallAlert: true,
      reasons: ["SĐT nằm trong danh sách hạn chế (từng boom hàng)"],
    };
  }

  let score = 0;
  const reasons: string[] = [];

  if (input.orderType === "DELIVERY") {
    if (input.completedOrdersCount === 0) {
      score += 20;
      reasons.push("Khách đặt giao hàng lần đầu");
    } else if (input.completedOrdersCount >= 3) {
      score -= 25;
    }

    if (input.totalAmount > 250_000) {
      score += 25;
      reasons.push(`Đơn giá trị cao (${Math.round(input.totalAmount / 1000)}k > 250k)`);
    }

    if (input.totalBoxes >= 5) {
      score += 15;
      reasons.push(`Số lượng lớn (${input.totalBoxes} phần)`);
    }

    if (input.orderHourVietnam >= 21.5 || input.orderHourVietnam < 6) {
      score += 20;
      reasons.push("Đặt khung giờ khuya (sau 21h30)");
    }

    if (input.distanceKm != null && input.distanceKm > 5) {
      score += 20;
      reasons.push(`Giao xa (${input.distanceKm.toFixed(1)}km > 5km)`);
    }
  } else {
    // Dine-in orders carry very low boom risk unless large / fast bot
    if (input.totalBoxes >= 8) {
      score += 15;
      reasons.push(`Đặt tại bàn số lượng lớn (${input.totalBoxes} phần)`);
    }
  }

  if (
    typeof input.formDurationMs === "number" &&
    input.formDurationMs > 0 &&
    input.formDurationMs < 2500
  ) {
    score += 30;
    reasons.push("Thao tác đặt đơn quá nhanh (< 2.5s)");
  }

  const clamped = Math.max(0, Math.min(100, score));
  const trustLabel: TrustLabel =
    input.completedOrdersCount >= 3
      ? "KHÁCH QUEN"
      : clamped >= 60
        ? "RỦI RO CAO"
        : "KHÁCH MỚI";

  return {
    riskScore: clamped,
    trustLabel,
    requirePrepaidVietQr: clamped >= 60,
    requireCallAlert: clamped >= 45,
    reasons,
  };
}

export function getVietnamHourDecimal(): number {
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Ho_Chi_Minh",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const [hh, mm] = fmt.format(new Date()).split(":").map(Number);
  return (hh || 0) + (mm || 0) / 60;
}

