import { after, type NextRequest } from "next/server";
import { getRepo } from "@/lib/db";
import { timingSafeEqualStr } from "@/lib/security";
import { sendTelegram } from "@/lib/telegram";

/** Allows a customer to self-cancel a PENDING & UNPAID order using its tracking token. */
export async function POST(
  req: NextRequest,
  ctx: RouteContext<"/api/orders/[id]/cancel">,
) {
  const { id } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as { token?: string };
  const token = typeof body.token === "string" ? body.token.trim() : "";

  const repo = getRepo();
  const [order, settings] = await Promise.all([repo.getOrder(id), repo.getSettings()]);
  if (!order) {
    return Response.json({ error: "Không tìm thấy đơn hàng." }, { status: 404 });
  }
  if (!settings.customer_cancel_enabled) {
    return Response.json(
      { error: "Vui lòng gọi hotline quán để được hỗ trợ hủy đơn." },
      { status: 403 },
    );
  }
  if (
    order.tracking_token &&
    (!token || !timingSafeEqualStr(token, order.tracking_token))
  ) {
    return Response.json({ error: "Không có quyền hủy đơn hàng này." }, { status: 403 });
  }
  if ((order.payment_status ?? "UNPAID") !== "UNPAID") {
    return Response.json(
      {
        error: `Đơn đã ghi nhận thanh toán. Vui lòng gọi hotline ${settings.hotline || "quán"} để hoàn tiền.`,
      },
      { status: 409 },
    );
  }
  if (order.status !== "PENDING") {
    return Response.json(
      { error: "Bếp đã tiếp nhận hoặc đơn đã kết thúc, không thể tự hủy." },
      { status: 409 },
    );
  }

  const updated = await repo.updateOrder(id, {
    status: "CANCELLED",
    updated_by: "Khách tự hủy",
  });

  if (settings.telegram_bot_token && settings.telegram_chat_id) {
    after(async () => {
      await sendTelegram(
        settings.telegram_bot_token,
        settings.telegram_chat_id,
        `🚫 <b>KHÁCH HÀNG TỰ HỦY ĐƠN (${order.order_code})</b>\n👤 Khách: ${order.customer_name || "Khách lẻ"}`,
      );
    });
  }

  return Response.json({ order: updated });
}

