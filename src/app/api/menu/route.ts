import { connection } from "next/server";
import { getMenu } from "@/lib/orders";

export async function GET() {
  await connection();
  return Response.json(await getMenu(), { headers: { "Cache-Control": "no-store" } });
}
