import { NextResponse, type NextRequest } from "next/server";
import { ADMIN_COOKIE, verifySession } from "@/lib/admin-auth";

export async function middleware(request: NextRequest) {
  if (request.nextUrl.pathname === "/admin/login") return NextResponse.next();
  const user = await verifySession(request.cookies.get(ADMIN_COOKIE)?.value);
  if (!user) return NextResponse.redirect(new URL("/admin/login", request.url));
  return NextResponse.next();
}

export const config = { matcher: ["/admin/:path*"] };
