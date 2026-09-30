// Formatting for the app. Compact numbers everywhere a dashboard shows money ($1.68K, $2.4M).

export const usdgToNumber = (raw: bigint | string | number) => Number(BigInt(raw)) / 1e6;
export const weiToEth = (raw: bigint | string | number) => Number(BigInt(raw)) / 1e18;

export function usd(n: number, opts: { compact?: boolean } = {}) {
  const compact = opts.compact ?? true;
  const a = Math.abs(n);
  if (compact && a >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (compact && a >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (compact && a >= 1e4) return `$${(n / 1e3).toFixed(1)}K`;
  if (a >= 1000) return `$${Math.round(n).toLocaleString("en-US")}`;
  if (a >= 1) return `$${n.toFixed(2)}`;
  if (a === 0) return "$0";
  return a >= 0.01 ? `$${n.toFixed(2)}` : `<$0.01`;
}

export function eth(n: number, dp?: number) {
  const a = Math.abs(n);
  const d = dp ?? (a >= 100 ? 1 : a >= 1 ? 3 : a >= 0.01 ? 4 : 6);
  return `${n.toFixed(d)} ETH`;
}

export function num(n: number) {
  const a = Math.abs(n);
  if (a >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (a >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  if (a >= 1e4) return `${(n / 1e3).toFixed(1)}K`;
  return Math.round(n).toLocaleString("en-US");
}

export const short = (a: string, n = 4) => (a ? `${a.slice(0, 2 + n)}…${a.slice(-n)}` : "");

export function ago(ts: string | number | Date) {
  const s = Math.max(0, Math.round((Date.now() - new Date(ts).getTime()) / 1000));
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export function countdown(seconds: number) {
  const s = Math.max(0, Math.round(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  return h ? `${h}h ${String(m).padStart(2, "0")}m` : `${m}:${String(r).padStart(2, "0")}`;
}
