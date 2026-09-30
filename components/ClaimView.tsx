"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { Address } from "viem";
import type { Claimable } from "../lib/data";
import { vaultAbi } from "../lib/abi";
import { TIERS } from "../lib/config";
import { usd } from "../lib/fmt";
import { quote, status, stage, TERMINAL, type Quote, type Status } from "../lib/oneclick";
import { PRIVACY_NOTE, ROUTES, addressError, type RouteId } from "../lib/routes";
import { explain, useWallet } from "./wallet";

type Resp = { items: Claimable[]; stealthWeightPct: number | null };

export function ClaimView() {
  const { account, connect } = useWallet();
  const [data, setData] = useState<Resp | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!account) return;
    const r = await fetch(`/api/claimable?wallet=${account}`, { cache: "no-store" });
    const j = await r.json();
    if (!r.ok) return setErr(j.error ?? "claims unavailable");
    setErr(null);
    setData(j as Resp);
  }, [account]);

  useEffect(() => {
    load();
  }, [load]);

  const tier = useMemo(() => [...TIERS].reverse().find((t) => (data?.stealthWeightPct ?? 0) >= t.minPct) ?? TIERS[0], [data]);

  if (!account) {
    return (
      <div className="panel mt-8 p-10 text-center">
        <p className="text-highlight">Connect the wallet that holds your coins</p>
        <p className="mt-2 text-sm text-mist">A claim is one transaction to the coin&apos;s vault. It never needs a token approval or a seed phrase.</p>
        <button type="button" className="btn mt-5" onClick={() => connect()}>
          Connect
        </button>
      </div>
    );
  }

  return (
    <div className="pt-4">
      <p className="kicker">Claim</p>
      <h1 className="display mt-3 text-4xl text-highlight">Your share, where you want it.</h1>
      <p className="mt-3 text-sm text-mist">
        $STEALTH tier: {tier.label} · route fee {(tier.feeBps / 100).toFixed(2)}%
      </p>
      {err ? <p className="mt-4 text-sm text-risk">{err}</p> : null}
      <ul className="mt-6 space-y-4">
        {(data?.items ?? []).map((it) => (
          <ClaimCard key={it.vault} it={it} account={account} feeBps={tier.feeBps} onDone={load} />
        ))}
      </ul>
      {data && data.items.length === 0 ? <p className="mt-6 text-sm text-mist">Nothing to claim for this wallet yet.</p> : null}
    </div>
  );
}

function ClaimCard({ it, account, feeBps, onDone }: { it: Claimable; account: Address; feeBps: number; onDone: () => void }) {
  const { write } = useWallet();
  const [route, setRoute] = useState<RouteId>("usdg");
  const [dest, setDest] = useState("");
  const [q, setQ] = useState<Quote | null>(null);
  const [st, setSt] = useState<Status | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const r = ROUTES.find((x) => x.id === route)!;
  const due = BigInt(it.claimable);
  const bps = route === "usdg" ? 0 : feeBps;
  const fee = (due * BigInt(bps)) / 10_000n; // the vault's own rounding
  const net = due - fee;
  const addrErr = route === "usdg" ? null : addressError(route, dest);
  const recipient = route === "zec" ? dest.trim() : dest.trim().toLowerCase();
  const tooSmall = route !== "usdg" && Number(net) / 1e6 < r.minUsd;

  // dry quote: the holder's own browser asks NEAR Intents; our servers never see the destination
  useEffect(() => {
    setQ(null);
    if (route === "usdg" || addrErr || tooSmall || net <= 0n) return;
    const t = setTimeout(() => {
      quote({ usdgUnits: net, destinationAsset: r.asset!, recipient, refundTo: account, dry: true })
        .then(setQ)
        .catch((e) => setMsg((e as Error).message));
    }, 400);
    return () => clearTimeout(t);
  }, [route, recipient, net, addrErr, tooSmall, account, r.asset]);

  const claim = async () => {
    if (!it.active) return;
    setMsg(null);
    try {
      if (route === "usdg") {
        await write({ address: it.vault, abi: vaultAbi, functionName: "claim", args: [BigInt(it.active.cumulative), it.active.proof, account, 0] });
        setMsg("Claimed. USDG is in your wallet.");
      } else {
        const live = await quote({ usdgUnits: net, destinationAsset: r.asset!, recipient, refundTo: account, dry: false });
        if (!live.depositAddress) throw new Error("The route returned no deposit address.");
        await write({ address: it.vault, abi: vaultAbi, functionName: "claim", args: [BigInt(it.active.cumulative), it.active.proof, live.depositAddress as Address, bps] });
        let s: Status | null = null;
        while (!s || !TERMINAL.includes(s)) {
          await new Promise((res) => setTimeout(res, 5000));
          s = await status(live.depositAddress).catch(() => s);
          setSt(s);
        }
      }
      onDone();
    } catch (e) {
      setMsg(explain(e));
    }
  };

  return (
    <li className="panel p-5">
      <div className="flex items-center justify-between">
        <p className="font-mono text-highlight">${it.symbol}</p>
        <p className="num text-xl text-usdg">{usd(Number(due) / 1e6, { compact: false })}</p>
      </div>
      {it.pending ? <p className="mt-1 text-xs text-dust">Next root claimable at {new Date(it.pending.activeAt).toLocaleString()}</p> : null}

      <div className="mt-4 flex flex-wrap gap-2">
        {ROUTES.map((x) => (
          <button key={x.id} type="button" className={"chip " + (x.id === route ? "border-emerald text-highlight" : "")} onClick={() => setRoute(x.id)}>
            {x.label}
          </button>
        ))}
      </div>

      {route !== "usdg" ? (
        <label className="mt-4 block text-sm text-mist">
          Lands at {r.lands}
          <input value={dest} onChange={(e) => setDest(e.target.value.trim())} placeholder={r.placeholder} spellCheck={false} autoComplete="off" className="field num mt-1.5 w-full" />
          {dest && addrErr ? <span className="mt-1 block text-xs text-risk">{addrErr}</span> : null}
          {tooSmall ? <span className="mt-1 block text-xs text-risk">This route needs at least ${r.minUsd}. Claims are cumulative, so waiting costs nothing.</span> : null}
        </label>
      ) : null}

      <p className="mt-3 text-xs text-dust">{PRIVACY_NOTE[route]}</p>
      <p className="num mt-2 text-xs text-mist">
        Route fee {(bps / 100).toFixed(2)}% ({usd(Number(fee) / 1e6, { compact: false })})
        {q ? ` · you receive about ${q.amountOutFormatted} ${r.short} in ~${q.timeEstimate}s` : ""}
      </p>

      <button type="button" className="btn mt-4" disabled={!it.active || due === 0n || Boolean(addrErr) || tooSmall} onClick={claim}>
        Claim {route === "usdg" ? "USDG" : `to ${r.short}`}
      </button>
      {st ? <p className="mt-2 text-xs text-glass-bright">{stage(st).label}</p> : null}
      {msg ? <p className="mt-2 text-xs text-mist">{msg}</p> : null}
    </li>
  );
}
