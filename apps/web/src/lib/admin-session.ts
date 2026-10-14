import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ADMIN_COOKIE, verifySession } from "./admin-auth";

/** Server-side guard for admin pages and actions (defense in depth). */
export async function requireAdmin(): Promise<string> {
  const user = await verifySession((await cookies()).get(ADMIN_COOKIE)?.value);
  if (!user) redirect("/admin/login");
  return user;
}
