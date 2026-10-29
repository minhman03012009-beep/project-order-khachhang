import type { NextRequest } from "next/server";
import { createSession, destroySession, isAdmin, verifyPin } from "@/lib/auth";

// Naive in-memory brute-force throttle (per server instance).
const attempts = new Map<string, { count: number; until: number }>();

export async function GET() {
  return Response.json({ authenticated: await isAdmin() });
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const now = Date.now();
  const rec = attempts.get(ip);
  if (rec && rec.until > now) {
    const wait = Math.ceil((rec.until - now) / 1000);
    return Response.json({ error: `Thử lại sau ${wait}s` }, { status: 429 });
  }

  const { pin } = (await req.json().catch(() => ({}))) as { pin?: string };
  if (!pin || !(await verifyPin(pin))) {
    const count = (rec?.count ?? 0) + 1;
    attempts.set(ip, { count, until: count >= 5 ? now + 60_000 : 0 });
    return Response.json({ error: "Mã PIN không đúng" }, { status: 401 });
  }
  attempts.delete(ip);
  await createSession();
  return Response.json({ ok: true });
}

export async function DELETE() {
  await destroySession();
  return Response.json({ ok: true });
}
