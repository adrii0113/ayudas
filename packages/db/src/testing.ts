import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { join } from "node:path";
import type { Database } from "./client";
import * as schema from "./schema";

/** In-memory Postgres (PGlite) with migrations applied. Tests only. */
export async function createTestDb(): Promise<Database> {
  const pg = drizzle(new PGlite(), { schema });
  await migrate(pg, { migrationsFolder: join(import.meta.dirname, "../drizzle") });
  // The repositories only use the query builder shared by both drivers.
  return pg as unknown as Database;
}
