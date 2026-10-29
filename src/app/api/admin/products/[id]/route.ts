import type { NextRequest } from "next/server";
import { adminRoute, sanitizeProduct } from "@/lib/admin";
import { getRepo } from "@/lib/db";
import type { Product } from "@/lib/types";

type Ctx = RouteContext<"/api/admin/products/[id]">;

export const PUT = adminRoute(async (req: NextRequest, ctx: Ctx) => {
  const { id } = await ctx.params;
  const repo = getRepo();
  const current = (await repo.listProducts()).find((p) => p.id === id);
  if (!current) return Response.json({ error: "Không tìm thấy món" }, { status: 404 });
  const patch = (await req.json()) as Partial<Product>;
  const product = sanitizeProduct({ ...current, ...patch }, id);
  return Response.json({ product: await repo.upsertProduct(product) });
});

export const DELETE = adminRoute(async (_req: NextRequest, ctx: Ctx) => {
  const { id } = await ctx.params;
  await getRepo().deleteProduct(id);
  return Response.json({ ok: true });
});
