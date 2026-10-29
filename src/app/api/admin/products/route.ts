import type { NextRequest } from "next/server";
import { adminRoute, sanitizeProduct } from "@/lib/admin";
import { getRepo } from "@/lib/db";
import type { Product } from "@/lib/types";

export const GET = adminRoute(async () => {
  return Response.json({ products: await getRepo().listProducts() });
});

export const POST = adminRoute(async (req: NextRequest) => {
  const raw = (await req.json()) as Partial<Product>;
  const repo = getRepo();
  const existing = await repo.listProducts();
  const product = sanitizeProduct({
    ...raw,
    id: undefined,
    sort_order: raw.sort_order ?? existing.length + 1,
  });
  return Response.json({ product: await repo.upsertProduct(product) }, { status: 201 });
});
