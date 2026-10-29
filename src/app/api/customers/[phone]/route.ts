import type { NextRequest } from "next/server";
import { getRepo } from "@/lib/db";
import type { CustomerLookupResponse } from "@/lib/types";
import { isValidPhone, maskAddress } from "@/lib/utils";

/** "Invisible account" lookup. Returns only a masked address — never the full one. */
export async function GET(_req: NextRequest, ctx: RouteContext<"/api/customers/[phone]">) {
  const { phone } = await ctx.params;
  if (!isValidPhone(phone)) {
    return Response.json({ found: false } satisfies CustomerLookupResponse);
  }
  const c = await getRepo().getCustomer(phone);
  const body: CustomerLookupResponse = c
    ? {
        found: true,
        name: c.name,
        masked_address: c.address ? maskAddress(c.address) : "",
        has_address: Boolean(c.address),
        has_location: c.lat != null && c.lng != null,
        total_orders: c.total_orders,
      }
    : { found: false };
  return Response.json(body, { headers: { "Cache-Control": "no-store" } });
}
