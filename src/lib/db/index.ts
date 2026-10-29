import "server-only";
import { LocalRepository } from "./local-repo";
import type { Repository } from "./repository";
import { SupabaseRepository } from "./supabase-repo";

const g = globalThis as unknown as { __indomieRepo?: Repository };

/**
 * Hybrid storage switch:
 *  - NEXT_PUBLIC_SUPABASE_URL + (SUPABASE_SERVICE_ROLE_KEY | NEXT_PUBLIC_SUPABASE_ANON_KEY) → Supabase
 *  - otherwise → local JSON file / in-memory store (zero config)
 */
export function getRepo(): Repository {
  if (g.__indomieRepo) return g.__indomieRepo;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  g.__indomieRepo =
    url && key ? new SupabaseRepository(url, key) : new LocalRepository();
  return g.__indomieRepo;
}

export type { Repository } from "./repository";
