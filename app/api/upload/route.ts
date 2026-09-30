import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import sharp from "sharp";
import { sql } from "../../../lib/db";
import { LIVE } from "../../../lib/config";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_BYTES = 4 * 1024 * 1024;
const TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"];
const hits = new Map<string, { n: number; at: number }>();

/** A coin logo: decoded, squared to 512 px, re-encoded as WebP. Nothing else about the upload is kept. */
export async function POST(req: Request) {
  if (!LIVE) return NextResponse.json({ error: "Launches open with the factory." }, { status: 403 });
  const ip = (req.headers.get("x-forwarded-for") ?? "local").split(",")[0].trim();
  const h = hits.get(ip);
  const now = Date.now();
  if (h && now - h.at < 3_600_000 && h.n >= 30) return NextResponse.json({ error: "Too many uploads. Try again later." }, { status: 429 });
  hits.set(ip, h && now - h.at < 3_600_000 ? { n: h.n + 1, at: h.at } : { n: 1, at: now });

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "No image." }, { status: 400 });
  if (!TYPES.includes(file.type)) return NextResponse.json({ error: "Use a PNG, JPG, WebP or GIF." }, { status: 415 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "Keep it under 4 MB." }, { status: 413 });
  try {
    const input = Buffer.from(await file.arrayBuffer());
    const out = await sharp(input, { limitInputPixels: 40_000_000, animated: false })
      .rotate()
      .resize(512, 512, { fit: "cover" })
      .webp({ quality: 86 })
      .toBuffer();
    const hash = createHash("sha256").update(out).digest("hex").slice(0, 32);
    await sql`insert into images (hash, mime, bytes) values (${hash}, 'image/webp', ${out}) on conflict (hash) do nothing`;
    const origin = process.env.NEXT_PUBLIC_APP_URL || new URL(req.url).origin;
    return NextResponse.json({ url: `${origin}/img/${hash}.webp` });
  } catch {
    return NextResponse.json({ error: "That file is not an image we can read." }, { status: 422 });
  }
}
