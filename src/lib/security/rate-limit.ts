import "server-only";
import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { logServerError } from "@/lib/errors";

type Bucket = { count: number; start: number };
const memoryBuckets = new Map<string, Bucket>();

function memoryAllow(key: string, limit: number, windowSeconds: number): boolean {
  const now = Date.now();
  const current = memoryBuckets.get(key);
  if (!current || now - current.start >= windowSeconds * 1000) {
    memoryBuckets.set(key, { count: 1, start: now });
    return true;
  }
  current.count += 1;
  return current.count <= limit;
}

export async function clientIp(): Promise<string> {
  const headerStore = await headers();
  return headerStore.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
}

export async function rateLimit(key: string, limit: number, windowSeconds: number): Promise<boolean> {
  if (!memoryAllow(key, limit, windowSeconds)) return false;

  const admin = createAdminClient();
  if (!admin) return true;

  const { data, error } = await admin.rpc("consume_rate_limit", {
    p_key: key,
    p_limit: limit,
    p_window_seconds: windowSeconds,
  });

  if (error) {
    logServerError("rate-limit", error);
    return true;
  }

  return data === true;
}
