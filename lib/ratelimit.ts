import "server-only";

// A soft per-IP limit for the read routes that fan out to the RPC. In memory, per process: enough to
// stop one client from hammering the chain through us, not a security boundary.
const buckets = new Map<string, { n: number; at: number }>();

export function clientIp(req: Request): string {
  return (req.headers.get("x-real-ip") ?? req.headers.get("x-forwarded-for") ?? "local").split(",")[0].trim();
}

export function limited(req: Request, max: number, windowMs = 60_000): boolean {
  const ip = clientIp(req);
  const now = Date.now();
  const b = buckets.get(ip);
  if (!b || now - b.at > windowMs) {
    if (buckets.size > 20_000) buckets.clear();
    buckets.set(ip, { n: 1, at: now });
    return false;
  }
  b.n++;
  return b.n > max;
}
