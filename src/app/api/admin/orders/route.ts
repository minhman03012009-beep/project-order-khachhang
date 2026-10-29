import { connection } from "next/server";
import { adminRoute } from "@/lib/admin";
import { getRepo } from "@/lib/db";

export const GET = adminRoute(async () => {
  await connection();
  return Response.json(
    { orders: await getRepo().listOrders(150) },
    { headers: { "Cache-Control": "no-store" } },
  );
});
