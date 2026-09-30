"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import type { BoardStats, CoinCard } from "../lib/data";
import { ago, eth, num, usd } from "../lib/fmt";

type Latest = { vault: string; roundId: number; at: string; usdg: number; symbol: string; token: string; holders: number };
type Board = { coins: CoinCard[]; stats: BoardStats | null; latest: Latest[] };

/** The board: PAID TO HOLDERS is the biggest number on the page and on every card. Refreshes every 15 s. */
export function BoardView({ initial }: { initial: Board | null }) {
  const [data, setData] = useState<Board | null>(initial);

  useEffect(() => {
    const t = setInterval(async () => {
      const r = await fetch("/api/board", { cache: "no-store" }).catch(() => null);
      if (r?.ok) setData((await r.json()) as Board);
    }, 15_000);
    return () => clearInterval(t);
  }, []);

  const stats = data?.stats;
  const coins = data?.coins ?? [];

  return (
    <div className="pt-4">
      <section className="panel p-6">
        <p className="kicker">Paid to holders</p>
        <p className="num mt-2 text-5xl font-semibold text-usdg">{usd(stats?.paidUsdg ?? 0, { compact: false })}</p>
        <p className="mt-2 text-sm text-mist">
          {num(stats?.rounds ?? 0)} rounds · {num(stats?.coins ?? 0)} coins · {num(stats?.keepers ?? 0)} keepers · {eth(stats?.vol24Eth ?? 0, 2)} traded in 24 h
        </p>
      </section>

      {data?.latest?.length ? (
        <ul className="mt-4 flex gap-3 overflow-x-auto text-xs text-mist">
          {data.latest.map((l) => (
            <li key={`${l.vault}-${l.roundId}`} className="chip whitespace-nowrap">
              ${l.symbol} round {l.roundId}: {usd(l.usdg)} to {l.holders} holders · {ago(l.at)}
            </li>
          ))}
        </ul>
      ) : null}

      {coins.length === 0 ? (
        <div className="panel mt-8 p-10 text-center">
          <p className="text-highlight">No coins yet</p>
          <p className="mt-2 text-sm text-mist">$STEALTH launches first on mainnet day. Every coin after it appears here with its vault and its PAID TO HOLDERS total.</p>
        </div>
      ) : (
        <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {coins.map((c) => (
            <li key={c.token}>
              <Link href={`/coin/${c.token}`} className="panel block p-5 hover:border-emerald">
                <div className="flex items-center justify-between">
                  <p className="font-mono font-semibold text-highlight">${c.symbol}</p>
                  <span className="chip">tax {c.taxBps / 100}%</span>
                </div>
                <p className="mt-1 truncate text-sm text-mist">{c.name}</p>
                <p className="micro mt-4">Paid to holders</p>
                <p className="num text-2xl font-semibold text-usdg">{usd(c.paidUsdg)}</p>
                <p className="mt-2 text-xs text-dust">
                  {c.rounds} rounds · {num(c.holders)} holders · {c.lastRoundAt ? `last round ${ago(c.lastRoundAt)}` : "no round yet"}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
