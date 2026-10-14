import "server-only";

export function alertsEnabled(): boolean {
  return Boolean(process.env.DATABASE_URL && process.env.ALERTS_ENCRYPTION_KEY);
}
