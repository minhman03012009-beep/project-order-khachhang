import type { NextRequest } from "next/server";
import { getRepo } from "@/lib/db";

/** Public order tracking — the UUID itself acts as the unguessable access key. */
export async function GET(_req: NextRequest, ctx: RouteContext<"/api/orders/[id]">) {
  const { id } = await ctx.params;
  const order = await getRepo().getOrder(id);
  if (!order) return Response.json({ error: "Không tìm thấy đơn hàng" }, { status: 404 });
  return Response.json(
    {
      id: order.id,
      order_code: order.order_code,
      status: order.status,
      order_type: order.order_type,
      table_number: order.table_number,
      items: order.items,
      shipping_fee: order.shipping_fee,
      total_amount: order.total_amount,
      payment_method: order.payment_method,
      created_at: order.created_at,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
