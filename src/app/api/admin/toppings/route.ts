import type { NextRequest } from "next/server";
import { adminRoute, sanitizeTopping } from "@/lib/admin";
import { getRepo } from "@/lib/db";
import type { Topping } from "@/lib/types";

export const GET = adminRoute(async () => {
  return Response.json({ toppings: await getRepo().listToppings() });
});

export const POST = adminRoute(async (req: NextRequest) => {
  const raw = (await req.json()) as Partial<Topping>;
  const repo = getRepo();
  const existing = await repo.listToppings();
  const topping = sanitizeTopping({
    ...raw,
    id: undefined,
    sort_order: raw.sort_order ?? existing.length + 1,
  });
  return Response.json({ topping: await repo.upsertTopping(topping) }, { status: 201 });
});
