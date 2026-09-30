"use client";
import { useEffect, useState } from "react";
import type { Address } from "viem";
import type { CoinCard } from "../lib/data";
import { vaultAbi } from "../lib/abi";
import { publicClient } from "../lib/chain";
import { eth, short, usd } from "../lib/fmt";
import { explain, useWallet } from "./wallet";

type Keeper = { caller: Address; rounds: number; tipsEth: number; coins: number; firsts: number; streak: number; lastAt: string };
type Live = Record<string, { ready: boolean; pendingEth: bigint }>;

/** Reads every vault's readiness straight from the chain, so a keeper never depends on our API. */
function useVaults(vaults: Address[], everyMs = 5000): Live {
  const [live, setLive] = useState<Live>({});
  useEffect(() => {
    if (!vaults.length) return;
    let stop = false;
    const tick = async () => {
      const res = await publicClient.multicall({
        contracts: vaults.flatMap((v) => [
          { address: v, abi: vaultAbi, functionName: "roundReady" } as const,
          { address: v, abi: vaultAbi, functionName: "pendingEth" } as const,
        ]),
        allowFailure: true,
      });
      if (stop) return;
      const next: Live = {};
      vaults.forEach((v, i) => {
        const r = res[i * 2];
        const p = res[i * 2 + 1];
        next[v] = { ready: r.status === "success" && Boolean(r.result), pendingEth: p.status === "success" ? (p.result as bigint) : 0n };
      });
      setLive(next);
    };
    tick();
    const t = setInterval(tick, everyMs);
    return () => {
      stop = true;
      clearInterval(t);
    };
  }, [vaults.join(","), everyMs]); // eslint-disable-line react-hooks/exhaustive-deps
  return live;
}

export function KeeperView({ coins, ethUsd, keepers }: { coins: CoinCard[]; ethUsd: number; keepers: Keeper[] }) {
  const live = useVaults(coins.map((c) => c.vault));
  const { write } = useWallet();
  const [msg, setMsg] = useState<string | null>(null);
  const ready = coins.filter((c) => live[c.vault]?.ready);

  const run = async (c: CoinCard) => {
    setMsg(null);
    try {
      await write({ address: c.vault, abi: vaultAbi, functionName: "runRound" });
      setMsg(`Round run on $${c.symbol}. The 3% tip is in your wallet.`);
    } catch (e) {
      setMsg(explain(e));
    }
  };

  return (
    <div className="pt-4">
      <p className="kicker">Keepers</p>
      <h1 className="display mt-3 text-4xl text-highlight">Run a round, take 3% of it.</h1>
      <p className="lede mt-4 max-w-2xl">
        No round waits for Stealthpad. Any wallet can run a ready round and is paid 3% of it, in ETH, in the same transaction. A round is ready when a vault holds
        0.02 ETH and an hour has passed since its last round.
      </p>
      {msg ? <p className="mt-4 text-sm text-glass-bright">{msg}</p> : null}

      <section className="mt-8">
        <p className="kicker">Ready now · {ready.length}</p>
        <ul className="mt-3 space-y-3">
          {ready.map((c) => {
            const tip = (Number(live[c.vault]?.pendingEth ?? 0n) / 1e18) * 0.03;
            return (
              <li key={c.vault} className="panel flex items-center justify-between p-4">
                <span className="font-mono text-highlight">${c.symbol}</span>
                <span className="num text-sm text-usdg">
                  +{eth(tip)} ({usd(tip * ethUsd)})
                </span>
                <button type="button" className="btn btn-sm" onClick={() => run(c)}>
                  Run round
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="mt-10">
        <p className="kicker">Leaderboard</p>
        <table className="mt-3 w-full text-left text-sm">
          <thead className="text-dust">
            <tr>
              <th className="py-2">Keeper</th>
              <th>Rounds</th>
              <th>Tips</th>
              <th>Coins</th>
              <th>First rounds</th>
              <th>Streak</th>
            </tr>
          </thead>
          <tbody className="num text-mist">
            {keepers.map((k) => (
              <tr key={k.caller} className="border-t border-line">
                <td className="py-2 font-mono">{short(k.caller)}</td>
                <td>{k.rounds}</td>
                <td>{eth(k.tipsEth)}</td>
                <td>{k.coins}</td>
                <td>{k.firsts}</td>
                <td>{k.streak} d</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
