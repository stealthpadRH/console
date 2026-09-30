import { sql } from "../../../lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(_req: Request, { params }: { params: Promise<{ file: string }> }) {
  const { file } = await params;
  const m = /^([0-9a-f]{32})\.webp$/.exec(file);
  if (!m) return new Response("not found", { status: 404 });
  const r = await sql`select bytes from images where hash = ${m[1]}`.catch(() => []);
  if (!r.length) return new Response("not found", { status: 404 });
  return new Response(new Uint8Array(r[0].bytes as Buffer), {
    headers: { "content-type": "image/webp", "cache-control": "public, max-age=31536000, immutable", "x-content-type-options": "nosniff" },
  });
}
