import { NextResponse } from "next/server";
import { getBoard, getLatest } from "../../../lib/data";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const [board, latest] = await Promise.all([getBoard(), getLatest()]);
    return NextResponse.json({ ...board, latest }, { headers: { "cache-control": "no-store" } });
  } catch {
    return NextResponse.json({ coins: [], stats: null, latest: [], error: "board unavailable" }, { status: 503 });
  }
}
