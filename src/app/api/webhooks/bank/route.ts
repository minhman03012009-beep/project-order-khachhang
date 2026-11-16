import { after, type NextRequest } from "next/server";
import { getRepo } from "@/lib/db";
import { timingSafeEqualStr } from "@/lib/security";
import { buildOrderInlineKeyboard, buildOrderMessage, sendTelegram } from "@/lib/telegram";
import { formatVND } from "@/lib/utils";

function extractAuthSecret(req: NextRequest): string {
  const apiKey = req.headers.get("x-api-key")?.trim();
  if (apiKey) return apiKey;
  const auth = req.headers.get("authorization")?.trim() ?? "";
  if (!auth) return "";
  return auth.replace(/^(Apikey|Bearer)\s+/i, "").trim();
}

function extractOrderCode(content: string): string | null {
  const m = /(?:INDOMIE[\s\-_]*|#)IND[\s\-_]*(\d{1,6})/i.exec(content);
  if (m) return `#IND-${m[1].padStart(3, "0")}`;
  const m2 = /\bIND[\s\-_]*(\d{1,6})\b/i.exec(content);
  if (m2) return `#IND-${m2[1].padStart(3, "0")}`;
  return null;
}

function parseBankPayload(raw: unknown): { content: string; amount: number; incoming: boolean } | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;

  // Casso format
  if (Array.isArray(obj.data) && obj.data.length > 0 && typeof obj.data[0] === "object") {
    const tx = obj.data[0] as Record<string, unknown>;
    const amount = Number(tx.amount ?? tx.transferAmount ?? 0);
    return {
      content: String(tx.description ?? tx.content ?? ""),
      amount: Number.isFinite(amount) ? Math.trunc(amount) : 0,
      incoming: amount > 0,
    };
  }

  // SePay format
  const amount = Number(obj.transferAmount ?? obj.amount ?? 0);
  const transferType = typeof obj.transferType === "string" ? obj.transferType.toLowerCase() : "in";
  return {
    content: String(obj.content ?? obj.description ?? obj.transferContent ?? ""),
    amount: Number.isFinite(amount) ? Math.trunc(amount) : 0,
    incoming: transferType === "in" && amount > 0,
  };
}

/**
 * POST /api/webhooks/bank — SePay / Casso auto-payment confirmation webhook.
 * Verifies bank_webhook_secret, extracts #IND-XXX, checks amount >= total_amount,
 * marks PAID + COOKING idempotently, and alerts Telegram.
 */
export async function POST(req: NextRequest) {
  const repo = getRepo();
  const settings = await repo.getSettings();
  const expected = settings.bank_webhook_secret || process.env.BANK_WEBHOOK_SECRET || "";
  if (!expected) {
    return Response.json({ error: "BANK_WEBHOOK_SECRET chưa được cấu hình." }, { status: 500 });
  }

  const provided = extractAuthSecret(req);
  if (!timingSafeEqualStr(provided, expected)) {
    return Response.json({ error: "Unauthorized webhook secret." }, { status: 401 });
  }

  const rawBody = await req.json().catch(() => null);
  const tx = parseBankPayload(rawBody);
  if (!tx) {
    return Response.json({ error: "Payload không hợp lệ." }, { status: 400 });
  }
  if (!tx.incoming) {
    return Response.json({ ok: true, ignored: "Not incoming transfer" });
  }

  const code = extractOrderCode(tx.content);
  if (!code) {
    return Response.json({ ok: true, ignored: "No order code matched" });
  }

  const order = await repo.getOrderByCode(code);
  if (!order) {
    return Response.json({ error: `Không tìm thấy đơn ${code}` }, { status: 404 });
  }

  if (order.payment_status === "PAID") {
    return Response.json({ ok: true, idempotent: true, order_code: order.order_code });
  }

  if (tx.amount < order.total_amount) {
    await repo.updateOrder(order.id, {
      payment_status: "PARTIALLY_PAID",
      paid_amount: tx.amount,
      updated_by: "Bank Webhook (Thiếu tiền)",
    });
    if (settings.telegram_bot_token && settings.telegram_chat_id) {
      after(async () => {
        await sendTelegram(
          settings.telegram_bot_token,
          settings.telegram_chat_id,
          `⚠️ <b>CHUYỂN KHOẢN THIẾU TIỀN (${order.order_code})</b>\nNhận: <b>${formatVND(tx.amount)}</b> / Cần thu: <b>${formatVND(order.total_amount)}</b>`,
        );
      });
    }
    return Response.json({
      ok: false,
      error: "Insufficient amount",
      expected: order.total_amount,
      received: tx.amount,
    });
  }

  const nextStatus = order.status === "PENDING" ? "COOKING" : order.status;
  const updated = await repo.updateOrder(order.id, {
    payment_status: "PAID",
    paid_amount: tx.amount,
    status: nextStatus,
    updated_by: "Bank Webhook (Tự động)",
  });

  if (updated && settings.telegram_bot_token && settings.telegram_chat_id) {
    after(async () => {
      const keyboard = settings.telegram_webhook_secret
        ? buildOrderInlineKeyboard(updated.id, updated.status)
        : undefined;
      await sendTelegram(
        settings.telegram_bot_token,
        settings.telegram_chat_id,
        buildOrderMessage(
          updated,
          null,
          `💚 Bank Webhook đã nhận đủ ${formatVND(tx.amount)} — Bếp tiến hành nấu ngay!`,
        ),
        keyboard,
      );
    });
  }

  return Response.json({
    ok: true,
    order_code: order.order_code,
    payment_status: "PAID",
    status: nextStatus,
  });
}

