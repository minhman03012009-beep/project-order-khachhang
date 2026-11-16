import type { NextRequest } from "next/server";
import { adminRoute } from "@/lib/admin";
import { getRepo } from "@/lib/db";
import { sanitizeCustomerText } from "@/lib/security";
import { isValidPhone } from "@/lib/utils";

export const GET = adminRoute(async () => {
  const repo = getRepo();
  const [customers, settings] = await Promise.all([
    repo.listCustomers(200),
    repo.getSettings(),
  ]);
  const blackSet = new Set(settings.blacklisted_phones ?? []);
  const enriched = customers.map((c) => ({
    ...c,
    is_blacklisted: Boolean(c.is_blacklisted || blackSet.has(c.phone)),
  }));
  return Response.json(
    { customers: enriched, blacklisted_phones: settings.blacklisted_phones ?? [] },
    { headers: { "Cache-Control": "no-store" } },
  );
});

export const PATCH = adminRoute(async (req: NextRequest) => {
  const body = (await req.json()) as {
    phone?: string;
    is_blacklisted?: boolean;
    notes?: string;
  };
  const phone = sanitizeCustomerText(body.phone, 15).replace(/\s+/g, "");
  if (!isValidPhone(phone)) {
    return Response.json({ error: "Số điện thoại không hợp lệ (10 số bắt đầu bằng 0)." }, { status: 400 });
  }

  const repo = getRepo();
  const [existing, settings] = await Promise.all([
    repo.getCustomer(phone),
    repo.getSettings(),
  ]);

  const blackSet = new Set(settings.blacklisted_phones ?? []);
  if (typeof body.is_blacklisted === "boolean") {
    if (body.is_blacklisted) blackSet.add(phone);
    else blackSet.delete(phone);
    await repo.updateSettings({ blacklisted_phones: Array.from(blackSet) });
  }

  const customer = await repo.upsertCustomer({
    phone,
    name: existing?.name ?? "",
    address: existing?.address ?? "",
    lat: existing?.lat ?? null,
    lng: existing?.lng ?? null,
    total_orders: existing?.total_orders ?? 0,
    is_blacklisted:
      typeof body.is_blacklisted === "boolean"
        ? body.is_blacklisted
        : Boolean(existing?.is_blacklisted),
    notes:
      typeof body.notes === "string"
        ? sanitizeCustomerText(body.notes, 200)
        : (existing?.notes ?? ""),
    updated_at: new Date().toISOString(),
  });

  return Response.json({
    customer,
    blacklisted_phones: Array.from(blackSet),
  });
});

