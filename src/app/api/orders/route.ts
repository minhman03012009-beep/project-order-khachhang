import { after, type NextRequest } from "next/server";
import { HttpError, placeOrder } from "@/lib/orders";
import { buildOrderMessage, sendTelegram } from "@/lib/telegram";
import type { CreateOrderInput } from "@/lib/types";

export async function POST(req: NextRequest) {
  let input: CreateOrderInput;
  try {
    input = (await req.json()) as CreateOrderInput;
  } catch {
    return Response.json({ error: "Dữ liệu không hợp lệ." }, { status: 400 });
  }

  try {
    const { order, customerOrderCount, settings } = await placeOrder(input);

    // Notify the owner after the response is sent → zero added latency for the customer.
    after(async () => {
      const result = await sendTelegram(
        settings.telegram_bot_token,
        settings.telegram_chat_id,
        buildOrderMessage(order, customerOrderCount),
      );
      if (!result.ok && settings.telegram_bot_token) {
        console.error(`[telegram] ${order.order_code}: ${result.error}`);
      }
    });

    return Response.json({ order, customerOrderCount }, { status: 201 });
  } catch (e) {
    if (e instanceof HttpError) {
      return Response.json({ error: e.message }, { status: e.status });
    }
    console.error("[orders] create failed", e);
    return Response.json(
      { error: "Có lỗi khi tạo đơn, vui lòng thử lại." },
      { status: 500 },
    );
  }
}
