import "server-only";
import type { Order, OrderStatus } from "./types";
import { formatVND } from "./utils";

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const LINE = "────────────────────";

export interface TelegramInlineButton {
  text: string;
  callback_data: string;
}

export interface TelegramInlineKeyboardMarkup {
  inline_keyboard: TelegramInlineButton[][];
}

export function buildOrderInlineKeyboard(
  orderId: string,
  status: OrderStatus,
): TelegramInlineKeyboardMarkup {
  if (status === "COMPLETED" || status === "CANCELLED") {
    return { inline_keyboard: [] };
  }
  if (status === "COOKING" || status === "DELIVERING") {
    return {
      inline_keyboard: [
        [
          { text: "✅ Hoàn tất", callback_data: `COMPLETED:${orderId}` },
          { text: "❌ Hủy đơn", callback_data: `CANCELLED:${orderId}` },
        ],
      ],
    };
  }
  return {
    inline_keyboard: [
      [
        { text: "👨‍🍳 Nhận nấu", callback_data: `COOKING:${orderId}` },
        { text: "✅ Hoàn tất", callback_data: `COMPLETED:${orderId}` },
        { text: "❌ Hủy đơn", callback_data: `CANCELLED:${orderId}` },
      ],
    ],
  };
}

export function buildOrderMessage(
  order: Order,
  customerOrderCount: number | null,
  extraNote?: string,
): string {
  const lines: string[] = [];
  lines.push(`🚨 <b>ĐƠN HÀNG MỚI (${esc(order.order_code)})</b>`);

  if (order.order_type === "DELIVERY") {
    const slot = order.scheduled_slot ? ` (${esc(order.scheduled_slot)})` : "";
    lines.push(`🏷️ Loại đơn: <b>🛵 GIAO TẬN NƠI</b>${slot}`);
  } else if (order.is_self_pickup) {
    lines.push(`🏷️ Loại đơn: <b>🛍️ GHÉ QUÁN LẤY (MANG ĐI)</b>`);
  } else if (order.table_number) {
    lines.push(`🏷️ Loại đơn: <b>🏪 TẠI ${esc(order.table_number.toUpperCase())}</b>`);
  } else {
    lines.push(`🏷️ Loại đơn: <b>🏪 TẠI QUÁN / MANG ĐI</b>`);
  }
  lines.push(LINE);

  const nth = customerOrderCount ? ` (⭐ Đơn thứ ${customerOrderCount})` : "";
  lines.push(`👤 Khách: <b>${esc(order.customer_name || "Khách lẻ")}</b>${nth}`);
  if (order.customer_phone) {
    lines.push(
      `📞 SĐT: <a href="tel:${esc(order.customer_phone)}">${esc(order.customer_phone)}</a>`,
    );
  }

  if (order.order_type === "DELIVERY") {
    if (order.delivery_address) {
      lines.push(`📍 Địa chỉ: ${esc(order.delivery_address)}`);
    }
    if (order.lat != null && order.lng != null) {
      const dist =
        order.distance_km != null ? ` (~${order.distance_km.toFixed(1)} km)` : "";
      lines.push(
        `🗺️ Định vị: <a href="https://www.google.com/maps?q=${order.lat},${order.lng}">📍 Bấm mở Google Maps chỉ đường</a>${dist}`,
      );
    }
  }

  if (order.risk_score != null && (order.risk_score >= 45 || order.require_call_alert)) {
    lines.push(
      `🛡️ Rủi ro: <b>${order.risk_score}/100 (${esc(order.trust_label ?? "CẢNH BÁO")})</b>${
        order.require_call_alert ? " ⚠️ <b>Nên gọi xác nhận!</b>" : ""
      }`,
    );
  }

  lines.push("");
  lines.push(`🍜 <b>CHI TIẾT MÓN ĐẶT:</b>`);
  order.items.forEach((item, i) => {
    const spicyStr = item.spicyLevel != null ? ` [Cấp ${item.spicyLevel}]` : "";
    lines.push(
      `<b>${i + 1}. ${esc(item.productName)}${spicyStr} (x${item.quantity})</b> - ${formatVND(item.subtotal)}`,
    );
    if (item.selectedToppings.length) {
      const tops = item.selectedToppings
        .map((t) => `${esc(t.name)} (x${t.quantity} - ${formatVND(t.price * t.quantity)})`)
        .join(", ");
      lines.push(`   + Topping: ${tops}`);
    }
    const notes = [...item.quickTags, item.itemNote].filter(Boolean).map(esc);
    if (notes.length) lines.push(`   + Ghi chú món: ${notes.join(", ")}`);
  });

  if (order.take_cutlery === false) {
    lines.push(`🌱 <i>Khách không lấy đũa muỗng nhựa</i>`);
  }

  const generalNotes: string[] = [];
  if (order.quick_notes.length) {
    generalNotes.push(order.quick_notes.map((n) => `[${esc(n)}]`).join(" "));
  }
  if (order.custom_note) generalNotes.push(`"${esc(order.custom_note)}"`);
  if (generalNotes.length) {
    lines.push("");
    lines.push(`📝 <b>GHI CHÚ CHUNG:</b>`);
    lines.push(generalNotes.join(" - "));
  }

  lines.push(LINE);
  if (order.shipping_fee > 0) {
    lines.push(`🛵 Phí ship: ${formatVND(order.shipping_fee)}`);
  }
  if ((order.discount_amount ?? 0) > 0) {
    lines.push(
      `🎟️ Giảm giá${order.voucher_code ? ` (${esc(order.voucher_code)})` : ""}: -${formatVND(order.discount_amount!)}`,
    );
  }
  const payBadge =
    order.payment_status === "PAID"
      ? `💚 ĐÃ THANH TOÁN (${order.payment_method})`
      : order.payment_method === "VIETQR"
        ? "Chuyển khoản VietQR"
        : "Tiền mặt";
  lines.push(`💳 Thanh toán: <b>${payBadge}</b>`);
  lines.push(`💰 <b>TỔNG THU: ${formatVND(order.total_amount)}</b>`);

  if (extraNote) {
    lines.push("", `📝 <i>${esc(extraNote)}</i>`);
  }
  return lines.join("\n");
}

export async function sendTelegram(
  token: string,
  chatId: string,
  text: string,
  replyMarkup?: TelegramInlineKeyboardMarkup,
): Promise<{ ok: boolean; error?: string }> {
  if (!token || !chatId) return { ok: false, error: "Chưa cấu hình Bot Token / Chat ID" };
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "HTML",
        disable_web_page_preview: true,
        ...(replyMarkup && replyMarkup.inline_keyboard.length > 0
          ? { reply_markup: replyMarkup }
          : {}),
      }),
      signal: AbortSignal.timeout(8000),
    });
    const json = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      description?: string;
    };
    if (!res.ok || !json.ok) {
      return { ok: false, error: json.description ?? `HTTP ${res.status}` };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function editTelegramMessage(
  token: string,
  chatId: string | number,
  messageId: number,
  text: string,
  replyMarkup?: TelegramInlineKeyboardMarkup,
): Promise<void> {
  if (!token) return;
  await fetch(`https://api.telegram.org/bot${token}/editMessageText`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      message_id: messageId,
      text,
      parse_mode: "HTML",
      disable_web_page_preview: true,
      ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
    }),
    signal: AbortSignal.timeout(8000),
  }).catch(() => undefined);
}

export async function answerTelegramCallback(
  token: string,
  callbackQueryId: string,
  text: string,
  showAlert = false,
): Promise<void> {
  if (!token) return;
  await fetch(`https://api.telegram.org/bot${token}/answerCallbackQuery`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      callback_query_id: callbackQueryId,
      text,
      show_alert: showAlert,
    }),
    signal: AbortSignal.timeout(8000),
  }).catch(() => undefined);
}
