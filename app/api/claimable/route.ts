import { NextResponse } from "next/server";
import { getClaimHistory, getClaimables, stealthWeightPct } from "../../../lib/data";
import { limited } from "../../../lib/ratelimit";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (limited(req, 60)) return NextResponse.json({ error: "Too many requests. Wait a minute." }, { status: 429 });
  const wallet = new URL(req.url).searchParams.get("wallet") ?? "";
  if (!/^0x[0-9a-fA-F]{40}$/.test(wallet)) return NextResponse.json({ error: "bad wallet" }, { status: 400 });
  try {
    const [items, weightPct, history] = await Promise.all([getClaimables(wallet), stealthWeightPct(wallet), getClaimHistory(wallet)]);
    return NextResponse.json({ items, stealthWeightPct: weightPct, history }, { headers: { "cache-control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "claims unavailable" }, { status: 503 });
  }
}
