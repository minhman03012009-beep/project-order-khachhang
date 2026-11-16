import type { NextRequest } from "next/server";
import { adminRoute } from "@/lib/admin";
import { getRepo } from "@/lib/db";
import type { Order, OrderStatus, PaymentStatus } from "@/lib/types";

const STATUSES: OrderStatus[] = ["PENDING", "COOKING", "DELIVERING", "COMPLETED", "CANCELLED"];
const PAY_STATUSES: PaymentStatus[] = ["UNPAID", "PARTIALLY_PAID", "PAID"];

export const PATCH = adminRoute(
  async (req: NextRequest, ctx: RouteContext<"/api/admin/orders/[id]">) => {
    const { id } = await ctx.params;
    const body = (await req.json()) as {
      status?: OrderStatus;
      payment_status?: PaymentStatus;
    };

    const existing = await getRepo().getOrder(id);
    if (!existing) return Response.json({ error: "Không tìm thấy đơn" }, { status: 404 });

    const patch: Partial<Order> = {};
    if (body.status !== undefined) {
      if (!STATUSES.includes(body.status)) {
        return Response.json({ error: "Trạng thái không hợp lệ" }, { status: 400 });
      }
      patch.status = body.status;
      patch.updated_by = "Admin";
    }
    if (body.payment_status !== undefined) {
      if (!PAY_STATUSES.includes(body.payment_status)) {
        return Response.json({ error: "Trạng thái thanh toán không hợp lệ" }, { status: 400 });
      }
      patch.payment_status = body.payment_status;
      patch.paid_amount = body.payment_status === "PAID" ? existing.total_amount : 0;
      patch.updated_by = "Thu ngân / Admin";
    }

    if (Object.keys(patch).length === 0) {
      return Response.json({ error: "Không có dữ liệu cập nhật" }, { status: 400 });
    }

    const order = await getRepo().updateOrder(id, patch);
    if (!order) return Response.json({ error: "Không tìm thấy đơn" }, { status: 404 });
    return Response.json({ order });
  },
);
