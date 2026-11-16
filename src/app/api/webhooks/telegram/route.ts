import type { NextRequest } from "next/server";
import { getRepo } from "@/lib/db";
import { timingSafeEqualStr } from "@/lib/security";
import {
  answerTelegramCallback,
  buildOrderInlineKeyboard,
  buildOrderMessage,
  editTelegramMessage,
} from "@/lib/telegram";
import type { OrderStatus } from "@/lib/types";
import { STATUS_LABEL } from "@/lib/utils";

interface TelegramUpdate {
  callback_query?: {
    id: string;
    from: { id: number; first_name?: string; username?: string };
    message?: { message_id: number; chat: { id: number } };
    data?: string;
  };
}

const VALID_NEXT: Set<OrderStatus> = new Set(["COOKING", "DELIVERING", "COMPLETED", "CANCELLED"]);

/**
 * POST /api/webhooks/telegram — Handle inline keyboard actions directly from Telegram Bot.
 */
export async function POST(req: NextRequest) {
  const repo = getRepo();
  const settings = await repo.getSettings();
  const expected = settings.telegram_webhook_secret || process.env.TELEGRAM_WEBHOOK_SECRET || "";
  if (!expected) {
    return Response.json({ error: "TELEGRAM_WEBHOOK_SECRET chưa cấu hình." }, { status: 500 });
  }

  const provided = req.headers.get("x-telegram-bot-api-secret-token")?.trim() ?? "";
  if (!timingSafeEqualStr(provided, expected)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const update = (await req.json().catch(() => null)) as TelegramUpdate | null;
  const cb = update?.callback_query;
  if (!cb) return Response.json({ ok: true });

  const botToken = settings.telegram_bot_token;
  const [rawStatus, orderId] = (cb.data ?? "").split(":");
  const nextStatus = rawStatus as OrderStatus;

  if (!orderId || !VALID_NEXT.has(nextStatus)) {
    await answerTelegramCallback(botToken, cb.id, "Lệnh không hợp lệ.", true);
    return Response.json({ ok: true });
  }

  const order = await repo.getOrder(orderId);
  if (!order) {
    await answerTelegramCallback(botToken, cb.id, "Không tìm thấy đơn hàng.", true);
    return Response.json({ ok: true });
  }

  if (order.status === "COMPLETED" || order.status === "CANCELLED") {
    await answerTelegramCallback(botToken, cb.id, `Đơn đã ở trạng thái ${STATUS_LABEL[order.status]}.`, true);
    return Response.json({ ok: true });
  }

  const staff = cb.from.username ? `@${cb.from.username}` : cb.from.first_name || String(cb.from.id);
  const updated = await repo.updateOrder(order.id, {
    status: nextStatus,
    updated_by: `Telegram (${staff})`,
  });

  if (updated && cb.message) {
    await editTelegramMessage(
      botToken,
      cb.message.chat.id,
      cb.message.message_id,
      buildOrderMessage(updated, null, `Cập nhật bởi ${staff}: ${STATUS_LABEL[nextStatus]}`),
      buildOrderInlineKeyboard(updated.id, updated.status),
    );
  }

  await answerTelegramCallback(botToken, cb.id, `Đã chuyển ${order.order_code} → ${STATUS_LABEL[nextStatus]}`);
  return Response.json({ ok: true });
}

