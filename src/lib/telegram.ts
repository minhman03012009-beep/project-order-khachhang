import "server-only";
import type { Order } from "./types";
import { formatVND } from "./utils";

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const LINE = "────────────────────";

export function buildOrderMessage(order: Order, customerOrderCount: number | null): string {
  const lines: string[] = [];
  lines.push(`🚨 <b>ĐƠN HÀNG MỚI (${esc(order.order_code)})</b>`);

  if (order.order_type === "DELIVERY") {
    lines.push(`🏷️ Loại đơn: <b>🛵 GIAO TẬN NƠI</b>`);
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

  lines.push("");
  lines.push(`🍜 <b>CHI TIẾT MÓN ĐẶT:</b>`);
  order.items.forEach((item, i) => {
    lines.push(
      `<b>${i + 1}. ${esc(item.productName)} (x${item.quantity})</b> - ${formatVND(item.subtotal)}`,
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
  lines.push(
    `💳 Thanh toán: <b>${order.payment_method === "VIETQR" ? "Chuyển khoản VietQR" : "Tiền mặt"}</b>`,
  );
  lines.push(`💰 <b>TỔNG THU: ${formatVND(order.total_amount)}</b>`);
  return lines.join("\n");
}

export async function sendTelegram(
  token: string,
  chatId: string,
  text: string,
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
