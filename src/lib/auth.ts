import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { getRepo } from "./db";

export const ADMIN_COOKIE = "indomie_admin";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days

function secret(): string {
  return process.env.ADMIN_SESSION_SECRET ?? "indomie-local-dev-secret";
}

/** Token binds to the current PIN, so changing the PIN logs everyone out. */
function sign(pin: string, expiresAt: number): string {
  const mac = createHmac("sha256", secret())
    .update(`${pin}.${expiresAt}`)
    .digest("hex");
  return `${expiresAt}.${mac}`;
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

export async function verifyPin(pin: string): Promise<boolean> {
  const settings = await getRepo().getSettings();
  return safeEqual(String(pin), String(settings.admin_pin));
}

export async function createSession(): Promise<void> {
  const settings = await getRepo().getSettings();
  const expiresAt = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS;
  const jar = await cookies();
  jar.set(ADMIN_COOKIE, sign(settings.admin_pin, expiresAt), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
}

export async function destroySession(): Promise<void> {
  const jar = await cookies();
  jar.delete(ADMIN_COOKIE);
}

export async function isAdmin(): Promise<boolean> {
  const jar = await cookies();
  const token = jar.get(ADMIN_COOKIE)?.value;
  if (!token) return false;
  const [expStr] = token.split(".");
  const exp = Number(expStr);
  if (!exp || exp < Date.now() / 1000) return false;
  const settings = await getRepo().getSettings();
  return safeEqual(token, sign(settings.admin_pin, exp));
}

/** Returns a 401 Response if not authenticated, otherwise null. */
export async function requireAdmin(): Promise<Response | null> {
  if (await isAdmin()) return null;
  return Response.json({ error: "Unauthorized" }, { status: 401 });
}
