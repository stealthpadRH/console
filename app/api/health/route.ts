import { NextResponse } from "next/server";
import { health } from "../../../lib/data";

export const dynamic = "force-dynamic";

export async function GET() {
  const h = await health().catch(() => null);
  return NextResponse.json({ ok: Boolean(h), ...(h ?? {}) }, { status: h ? 200 : 503, headers: { "cache-control": "no-store" } });
}
