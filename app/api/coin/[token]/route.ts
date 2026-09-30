import { NextResponse } from "next/server";
import { coinIndexed, getCoin } from "../../../../lib/data";

export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!/^0x[0-9a-fA-F]{40}$/.test(token)) return NextResponse.json({ error: "bad address" }, { status: 400 });
  // ?probe=1: a just-launched coin waits for the indexer; answer "not yet" without an error status
  if (new URL(req.url).searchParams.get("probe") === "1") {
    const indexed = await coinIndexed(token).catch(() => false);
    return NextResponse.json({ indexed }, { headers: { "cache-control": "no-store" } });
  }
  const data = await getCoin(token).catch(() => null);
  if (!data) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(data, { headers: { "cache-control": "no-store" } });
}
