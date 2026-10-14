import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

export type Database = ReturnType<typeof createDb>;

export function createDb(url = process.env.DATABASE_URL) {
  if (!url) throw new Error("DATABASE_URL is not set");
  // `prepare: false` keeps it compatible with transaction poolers (Supabase/Neon).
  // Use DATABASE_POOL_MAX=1 on serverless functions or with the local PGlite server.
  const client = postgres(url, { prepare: false, max: Number(process.env.DATABASE_POOL_MAX ?? 5) });
  return drizzle(client, { schema });
}
