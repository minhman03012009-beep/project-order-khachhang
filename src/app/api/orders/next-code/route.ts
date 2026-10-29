import { connection } from "next/server";
import { getRepo } from "@/lib/db";

/** Preview of the next order code so the VietQR memo can be shown before checkout. */
export async function GET() {
  await connection();
  const code = await getRepo().nextOrderCode();
  return Response.json({ code }, { headers: { "Cache-Control": "no-store" } });
}
