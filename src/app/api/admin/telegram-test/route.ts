import type { NextRequest } from "next/server";
import { adminRoute } from "@/lib/admin";
import { getRepo } from "@/lib/db";
import { sendTelegram } from "@/lib/telegram";

/** Sends a test message. Uses values from the body (unsaved form) or falls back to saved settings. */
export const POST = adminRoute(async (req: NextRequest) => {
  const body = (await req.json().catch(() => ({}))) as {
    token?: string;
    chatId?: string;
  };
  const settings = await getRepo().getSettings();
  const token = body.token?.trim() || settings.telegram_bot_token;
  const chatId = body.chatId?.trim() || settings.telegram_chat_id;
  const now = new Date().toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" });
  const result = await sendTelegram(
    token,
    chatId,
    `✅ <b>Kết nối thành công!</b>\n🍜 ${settings.store_name} sẽ gửi đơn hàng mới về đây.\n🕒 ${now}`,
  );
  return Response.json(result, { status: result.ok ? 200 : 400 });
});
