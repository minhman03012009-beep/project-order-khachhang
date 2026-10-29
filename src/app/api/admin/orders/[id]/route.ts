import type { NextRequest } from "next/server";
import { adminRoute } from "@/lib/admin";
import { getRepo } from "@/lib/db";
import type { OrderStatus } from "@/lib/types";

const STATUSES: OrderStatus[] = ["PENDING", "COOKING", "DELIVERING", "COMPLETED", "CANCELLED"];

export const PATCH = adminRoute(
  async (req: NextRequest, ctx: RouteContext<"/api/admin/orders/[id]">) => {
    const { id } = await ctx.params;
    const { status } = (await req.json()) as { status?: OrderStatus };
    if (!status || !STATUSES.includes(status)) {
      return Response.json({ error: "Trạng thái không hợp lệ" }, { status: 400 });
    }
    const order = await getRepo().updateOrderStatus(id, status);
    if (!order) return Response.json({ error: "Không tìm thấy đơn" }, { status: 404 });
    return Response.json({ order });
  },
);
