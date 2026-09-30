import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getCoin } from "../../../lib/data";
import { explorerAddress } from "../../../lib/config";
import { ago, usd } from "../../../lib/fmt";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Coin" };

const valid = (t: string) => /^0x[0-9a-fA-F]{40}$/.test(t);

/** One coin: its vault, PAID TO HOLDERS, and every round with its root status. */
export default async function CoinPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!valid(token)) notFound();
  const d = await getCoin(token).catch(() => null);
  if (!d) notFound();
  const c = d.coin;
  return (
    <div className="pt-4">
      <p className="kicker">
        ${c.symbol} · creator tax {c.taxBps / 100}%
      </p>
      <h1 className="display mt-3 text-4xl text-highlight">{c.name}</h1>
      <p className="micro mt-6">Paid to holders</p>
      <p className="num text-5xl font-semibold text-usdg">{usd(c.paidUsdg, { compact: false })}</p>
      <p className="mt-2 text-xs text-dust">
        Vault <a href={explorerAddress(c.vault)}>{c.vault}</a> · no owner, no withdraw, no upgrade, no pause
      </p>
      <table className="mt-8 w-full text-left text-sm">
        <thead className="text-dust">
          <tr>
            <th className="py-2">Round</th>
            <th>When</th>
            <th>To holders</th>
            <th>Holders</th>
            <th>Root</th>
          </tr>
        </thead>
        <tbody className="num text-mist">
          {d.rounds.map((r) => (
            <tr key={r.roundId} className="border-t border-line">
              <td className="py-2">{r.roundId}</td>
              <td>{ago(r.at)}</td>
              <td>{usd(r.usdg)}</td>
              <td>{r.holdersPaid ?? "..."}</td>
              <td>{r.root ? r.root.status : "awaiting attester"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
