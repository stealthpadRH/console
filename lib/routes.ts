// The landings. Asset ids are NEAR Intents 1Click's own (GET /v0/tokens, checked 2026-09-28).
// NEAR Intents delivers Zcash to TRANSPARENT addresses only (docs.near-intents.org, chain support:
// "Transparent addresses only"; a shielded zs1 recipient is rejected). The holder shields it after it
// lands. Aleo is fully supported (aleo1… addresses).
import { sha256 } from "viem";

export type RouteId = "usdg" | "zec" | "usdcx" | "usad";

export const USDG_ASSET = "nep141:hood-0x5fc5360d0400a0fd4f2af552add042d716f1d168.omft.near";

export const ROUTES: {
  id: RouteId;
  label: string;
  short: string;
  asset: string | null;
  decimals: number;
  lands: string;
  placeholder: string;
  tone: string;
  minUsd: number;
}[] = [
  { id: "usdg", label: "USDG", short: "USDG", asset: null, decimals: 6, lands: "the same wallet, on Robinhood Chain", placeholder: "", tone: "var(--usdg)", minUsd: 0 },
  { id: "zec", label: "Zcash", short: "ZEC", asset: "nep141:zec.omft.near", decimals: 8, lands: "your Zcash wallet's transparent address, then you shield it", placeholder: "t1…", tone: "var(--zec)", minUsd: 5 },
  { id: "usdcx", label: "USDCx on Aleo", short: "USDCx", asset: "nep141:aleo-usdcx.omft.near", decimals: 6, lands: "an Aleo address", placeholder: "aleo1…", tone: "var(--aleo)", minUsd: 5 },
  { id: "usad", label: "USAD on Aleo", short: "USAD", asset: "nep141:aleo-usad.omft.near", decimals: 6, lands: "an Aleo address", placeholder: "aleo1…", tone: "var(--aleo)", minUsd: 5 },
];

// ── address checks: shape AND checksum, so a typo is caught here, before any quote or signature ──

const B58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
function base58(s: string): Uint8Array | null {
  let n = 0n;
  for (const c of s) {
    const i = B58.indexOf(c);
    if (i < 0) return null;
    n = n * 58n + BigInt(i);
  }
  const out: number[] = [];
  while (n > 0n) {
    out.unshift(Number(n & 0xffn));
    n >>= 8n;
  }
  for (const c of s) {
    if (c !== "1") break;
    out.unshift(0);
  }
  return Uint8Array.from(out);
}

/** Zcash transparent: base58check, version 0x1CB8 (t1, key hash) or 0x1CBD (t3, script hash). */
export function zcashTransparentValid(a: string): boolean {
  const b = base58(a);
  if (!b || b.length !== 26 || b[0] !== 0x1c || (b[1] !== 0xb8 && b[1] !== 0xbd)) return false;
  const sum = sha256(sha256(b.slice(0, 22), "bytes"), "bytes");
  return sum[0] === b[22] && sum[1] === b[23] && sum[2] === b[24] && sum[3] === b[25];
}

const BECH = "qpzry9x8gf2tvdw0s3jn54khce6mua7l";
/** Aleo: bech32m with the "aleo" prefix, 63 characters. */
export function aleoValid(addr: string): boolean {
  const a = addr.toLowerCase();
  if (addr !== a && addr !== addr.toUpperCase()) return false;
  if (a.length !== 63 || !a.startsWith("aleo1")) return false;
  const data = [...a.slice(5)].map((c) => BECH.indexOf(c));
  if (data.some((d) => d < 0)) return false;
  const hrp = "aleo";
  const values = [...[...hrp].map((c) => c.charCodeAt(0) >> 5), 0, ...[...hrp].map((c) => c.charCodeAt(0) & 31), ...data];
  const GEN = [0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3];
  let chk = 1;
  for (const v of values) {
    const top = chk >>> 25;
    chk = (((chk & 0x1ffffff) << 5) ^ v) >>> 0;
    for (let i = 0; i < 5; i++) if ((top >>> i) & 1) chk = (chk ^ GEN[i]) >>> 0;
  }
  return chk === 0x2bc830a3;
}

export function addressError(route: RouteId, addr: string): string | null {
  const a = addr.trim();
  if (route === "usdg") return null;
  if (!a) return "Paste the address the payout should land at.";
  if (route === "zec") {
    if (/^(u1|zs1|zc)/.test(a)) return "The route cannot deliver to shielded or unified addresses yet. Use your wallet's transparent address (t1…), then shield it when it lands.";
    if (!/^t[13]/.test(a) || a.length !== 35) return "Not a Zcash transparent address. It starts with t1 and is 35 characters long.";
    return zcashTransparentValid(a) ? null : "That address fails its checksum: one character is off. Copy it again from your wallet.";
  }
  if (!a.toLowerCase().startsWith("aleo1") || a.length !== 63) return "Not an Aleo address. It starts with aleo1 and is 63 characters long.";
  return aleoValid(a) ? null : "That address fails its checksum: one character is off. Copy it again from your wallet.";
}

/** What the landing looks like on the destination chain, said plainly before anyone signs. */
export const PRIVACY_NOTE: Record<RouteId, string> = {
  usdg: "USDG lands in the wallet that claims. Everything about it is public on Robinhood Chain.",
  zec: "Zcash lands at a transparent address, which is visible on the Zcash chain. Shield it in your wallet (Zashi and most Zcash wallets do this in one step); from then on its moves are private.",
  usdcx: "Arrives as USDCx on Aleo. Aleo transfers can be private: move it with a private transfer from your Aleo wallet.",
  usad: "Arrives as USAD on Aleo. Aleo transfers can be private: move it with a private transfer from your Aleo wallet.",
};
