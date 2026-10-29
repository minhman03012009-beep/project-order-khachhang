import type { NextRequest } from "next/server";
import { adminRoute, sanitizeTopping } from "@/lib/admin";
import { getRepo } from "@/lib/db";
import type { Topping } from "@/lib/types";

type Ctx = RouteContext<"/api/admin/toppings/[id]">;

export const PUT = adminRoute(async (req: NextRequest, ctx: Ctx) => {
  const { id } = await ctx.params;
  const repo = getRepo();
  const current = (await repo.listToppings()).find((t) => t.id === id);
  if (!current) return Response.json({ error: "Không tìm thấy topping" }, { status: 404 });
  const patch = (await req.json()) as Partial<Topping>;
  const topping = sanitizeTopping({ ...current, ...patch }, id);
  return Response.json({ topping: await repo.upsertTopping(topping) });
});

export const DELETE = adminRoute(async (_req: NextRequest, ctx: Ctx) => {
  const { id } = await ctx.params;
  await getRepo().deleteTopping(id);
  return Response.json({ ok: true });
});
