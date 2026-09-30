import { getLeafFile } from "../../../../../lib/data";

export const dynamic = "force-dynamic";

/** The attester's leaf file for one round, byte-for-byte what its leaf_hash commits to. */
export async function GET(_req: Request, { params }: { params: Promise<{ vault: string; round: string }> }) {
  const { vault, round } = await params;
  if (!/^0x[0-9a-fA-F]{40}$/.test(vault) || !/^\d+$/.test(round)) return new Response("bad request", { status: 400 });
  const f = await getLeafFile(vault, Number(round)).catch(() => null);
  if (!f) return new Response("not found", { status: 404 });
  return new Response(f.file, {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "x-leaf-hash": f.hash,
      "cache-control": "public, max-age=31536000, immutable",
      "content-disposition": `inline; filename="stealthpad-${vault.toLowerCase()}-round-${round}.json"`,
    },
  });
}
