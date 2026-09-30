"use client";
// NEAR Intents 1Click, called straight from the holder's browser (the API allows any origin), so
// Stealthpad's servers never see or store the destination. Docs: docs.near-intents.org
import { USDG_ASSET } from "./routes";

const BASE = "https://1click.chaindefuser.com/v0";

export type Quote = {
  depositAddress?: string;
  amountIn: string;
  amountInFormatted: string;
  amountOut: string;
  amountOutFormatted: string;
  amountOutUsd?: string;
  amountInUsd?: string;
  minAmountOut: string;
  timeEstimate: number;
  deadline?: string;
};

export type Status = "PENDING_DEPOSIT" | "KNOWN_DEPOSIT_TX" | "INCOMPLETE_DEPOSIT" | "PROCESSING" | "SUCCESS" | "REFUNDED" | "FAILED";

/** A quote for exactly `usdgUnits` of USDG (6 dp) delivered as `destinationAsset` to `recipient`.
 *  Refunds, if the quote expires unfilled, go back to the holder's own Robinhood Chain wallet. */
export async function quote(p: { usdgUnits: bigint; destinationAsset: string; recipient: string; refundTo: string; dry: boolean }): Promise<Quote> {
  const body = {
    dry: p.dry,
    swapType: "EXACT_INPUT",
    slippageTolerance: 100,
    originAsset: USDG_ASSET,
    depositType: "ORIGIN_CHAIN",
    destinationAsset: p.destinationAsset,
    amount: p.usdgUnits.toString(),
    refundTo: p.refundTo,
    refundType: "ORIGIN_CHAIN",
    recipient: p.recipient.trim(),
    recipientType: "DESTINATION_CHAIN",
    deadline: new Date(Date.now() + 30 * 60_000).toISOString(),
    referral: "stealthpad",
    quoteWaitingTimeMs: 3000,
  };
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), 25_000);
  try {
    const r = await fetch(`${BASE}/quote`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body), signal: ac.signal });
    const j = (await r.json().catch(() => ({}))) as { quote?: Quote; message?: string };
    if (!r.ok || !j.quote) throw new Error(j.message || "No route for this amount right now. Try again in a moment.");
    return j.quote;
  } finally {
    clearTimeout(t);
  }
}

export async function status(depositAddress: string): Promise<Status | null> {
  const r = await fetch(`${BASE}/status?depositAddress=${encodeURIComponent(depositAddress)}`, { cache: "no-store" });
  if (r.status === 404) return null;
  if (!r.ok) throw new Error("status unavailable");
  return ((await r.json()) as { status: Status }).status;
}

export const TERMINAL: Status[] = ["SUCCESS", "REFUNDED", "FAILED"];
export function stage(s: Status | null): { label: string; step: number } {
  switch (s) {
    case "PENDING_DEPOSIT": return { label: "Waiting for the claim to arrive", step: 0 };
    case "KNOWN_DEPOSIT_TX": return { label: "Deposit seen", step: 1 };
    case "INCOMPLETE_DEPOSIT": return { label: "Short deposit", step: 1 };
    case "PROCESSING": return { label: "Solvers delivering", step: 2 };
    case "SUCCESS": return { label: "Delivered", step: 3 };
    case "REFUNDED": return { label: "Refunded to your wallet", step: 3 };
    case "FAILED": return { label: "Failed", step: 3 };
    default: return { label: "Preparing", step: 0 };
  }
}
