/** Daily alerts job. Requires DATABASE_URL, ALERTS_ENCRYPTION_KEY, RESEND_API_KEY, NEXT_PUBLIC_SITE_URL. */
import { createDb, encryptionKey } from "@tetoca/db";
import { runAlerts } from "../job";
import { createMailer } from "../mailer";

const db = createDb();
const result = await runAlerts({
  db,
  key: encryptionKey(),
  mailer: createMailer(),
  siteUrl: (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, ""),
});
console.log(result);
await db.$client.end();
process.exit(result.failures ? 1 : 0);
