import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { join } from "node:path";
import type { Database } from "./client";
import { buildTerritoryRows, seedTerritories } from "./registry";
import * as schema from "./schema";

/** In-memory Postgres (PGlite) with migrations applied. Tests only. */
export async function createTestDb(): Promise<Database> {
  const pg = drizzle(new PGlite(), { schema });
  await migrate(pg, { migrationsFolder: join(import.meta.dirname, "../drizzle") });
  // The repositories only use the query builder shared by both drivers.
  const db = pg as unknown as Database;
  // Country, regions and provinces (municipalities are added per test when needed).
  await seedTerritories(db, buildTerritoryRows([]));
  return db;
}
