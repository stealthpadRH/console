"use client";
import { useEffect, useState } from "react";
import { parseEther, toHex, type Address, type Hex } from "viem";
import { factoryAbi, ponsAbi } from "../lib/abi";
import { publicClient } from "../lib/chain";
import { FACTORY, LIVE, PONS, SPLIT } from "../lib/config";
import { explain, useWallet } from "./wallet";

const TAXES = [1, 2, 3, 4, 5] as const;

/** One signature: the factory deploys the vault and launches on Pons V2 with the vault as creator fee recipient. */
export function LaunchForm({ ethUsd }: { ethUsd: number }) {
  const { account, write } = useWallet();
  const [name, setName] = useState("");
  const [symbol, setSymbol] = useState("");
  const [website, setWebsite] = useState("");
  const [logo, setLogo] = useState("");
  const [tax, setTax] = useState<(typeof TAXES)[number]>(3);
  const [firstBuy, setFirstBuy] = useState("");
  const [launchFee, setLaunchFee] = useState<bigint>(0n);
  const [predicted, setPredicted] = useState<Address | null>(null);
  const [salt] = useState<Hex>(() => toHex(crypto.getRandomValues(new Uint8Array(32))));
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!LIVE) return;
    publicClient.readContract({ address: PONS, abi: ponsAbi, functionName: "launchFee" }).then(setLaunchFee).catch(() => {});
  }, []);

  useEffect(() => {
    if (!LIVE || !account) return setPredicted(null);
    publicClient
      .readContract({ address: FACTORY, abi: factoryAbi, functionName: "predict", args: [account, salt, tax * 100] })
      .then(setPredicted)
      .catch(() => setPredicted(null));
  }, [account, salt, tax]);

  if (!LIVE) {
    return (
      <div className="panel mt-8 p-10 text-center">
        <p className="text-highlight">Launches open with the factory</p>
        <p className="mt-2 text-sm text-mist">The StealthFactory deploys on mainnet day, and $STEALTH launches through it first.</p>
      </div>
    );
  }

  const upload = async (f: File) => {
    const body = new FormData();
    body.append("file", f);
    const r = await fetch("/api/upload", { method: "POST", body });
    const j = await r.json();
    if (r.ok) setLogo(j.url);
    else setMsg(j.error);
  };

  // what holders would receive per day at three volumes, so the tax choice is concrete
  const perDay = [5, 20, 100].map((vol) => ({ vol, usd: vol * (tax / 100) * SPLIT.holders * ethUsd }));
  const websiteErr = website && !/^https:\/\/[^\s]+\.[^\s]+$/.test(website) ? "Use a full https:// link." : "";
  const valid = name.trim().length > 0 && /^[A-Za-z0-9]{1,10}$/.test(symbol) && !websiteErr;

  const launch = async () => {
    setMsg(null);
    try {
      const value = launchFee + (firstBuy ? parseEther(firstBuy) : 0n);
      const input = {
        name: name.trim(),
        symbol: symbol.toUpperCase(),
        logo,
        description: "",
        socials: { twitter: "", telegram: "", discord: "", website, farcaster: "" },
        salt,
      };
      await write({ address: FACTORY, abi: factoryAbi, functionName: "launch", args: [input, tax * 100, 0n], value });
      setMsg(`$${symbol.toUpperCase()} is live. Its vault: ${predicted ?? "see the board"}.`);
    } catch (e) {
      setMsg(explain(e));
    }
  };

  return (
    <div className="pt-4">
      <p className="kicker">Launch</p>
      <h1 className="display mt-3 text-4xl text-highlight">A coin whose tax pays its holders.</h1>
      <div className="panel mt-6 grid gap-4 p-6">
        <input className="field" placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
        <input className="field" placeholder="Ticker" value={symbol} onChange={(e) => setSymbol(e.target.value.trim())} />
        <input className="field" placeholder="https://" value={website} onChange={(e) => setWebsite(e.target.value.trim())} />
        {websiteErr ? <p className="text-xs text-risk">{websiteErr}</p> : null}
        <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />

        <div>
          <p className="micro">Creator tax, fixed forever</p>
          <div className="mt-2 flex gap-2">
            {TAXES.map((t) => (
              <button key={t} type="button" className={"chip " + (t === tax ? "border-emerald text-highlight" : "")} onClick={() => setTax(t)}>
                {t}%
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-dust">
            Holders would receive about {perDay.map((p) => `$${Math.round(p.usd).toLocaleString("en-US")}/day at ${p.vol} ETH volume`).join(" · ")}. No launcher cut.
          </p>
        </div>

        <input className="field" placeholder="First buy in ETH (optional)" value={firstBuy} onChange={(e) => setFirstBuy(e.target.value.trim())} inputMode="decimal" />
        <p className="text-xs text-dust">Vault address: {predicted ?? "connect to see it"}. Launch fee: the Pons V2 fee plus gas; Stealthpad adds none.</p>
        <button type="button" className="btn" disabled={!valid} onClick={launch}>
          Launch ${symbol.toUpperCase() || "COIN"}
        </button>
        {msg ? <p className="text-sm text-mist">{msg}</p> : null}
      </div>
    </div>
  );
}
