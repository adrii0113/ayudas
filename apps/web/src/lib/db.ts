import "server-only";
import { createDb, type Database } from "@tetoca/db";

let db: Database | undefined;

/** Lazily created, shared database client (server only). */
export function getDb(): Database {
  db ??= createDb();
  return db;
}
