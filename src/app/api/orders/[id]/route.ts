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
      is_self_pickup: order.is_self_pickup ?? false,
      items: order.items,
      quick_notes: order.quick_notes,
      custom_note: order.custom_note,
      shipping_fee: order.shipping_fee,
      discount_amount: order.discount_amount ?? 0,
      voucher_code: order.voucher_code ?? "",
      take_cutlery: order.take_cutlery ?? true,
      scheduled_slot: order.scheduled_slot ?? "",
      total_amount: order.total_amount,
      payment_method: order.payment_method,
      payment_status: order.payment_status ?? "UNPAID",
      paid_amount: order.paid_amount ?? 0,
      expires_at: order.expires_at ?? null,
      updated_by: order.updated_by ?? "",
      created_at: order.created_at,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
