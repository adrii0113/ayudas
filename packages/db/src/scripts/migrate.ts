import { migrate } from "drizzle-orm/postgres-js/migrator";
import { join } from "node:path";
import { findRepoRoot } from "../catalog";
import { createDb } from "../client";

const db = createDb();
await migrate(db, { migrationsFolder: join(findRepoRoot(), "packages/db/drizzle") });
console.log("Migrations applied");
await db.$client.end();
