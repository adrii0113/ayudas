import { NextResponse, type NextRequest } from "next/server";
import { deleteAction } from "@/app/alertas/actions";

/** RFC 8058 one-click unsubscribe (mail clients POST here). */
export async function POST(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("id") ?? "";
  const token = request.nextUrl.searchParams.get("token") ?? "";
  const ok = await deleteAction(id, token);
  return new NextResponse(null, { status: ok ? 200 : 404 });
}

/** A plain visit shows the confirmation page instead of deleting. */
export function GET(request: NextRequest) {
  const url = new URL("/alertas/baja", request.url);
  url.search = request.nextUrl.search;
  return NextResponse.redirect(url);
}
