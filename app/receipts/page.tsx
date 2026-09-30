import type { Metadata } from "next";
import { getReceipts } from "../../lib/data";
import { ago, usd } from "../../lib/fmt";

export const metadata: Metadata = { title: "Receipts" };
export const dynamic = "force-dynamic";

/** One card per round: how much USDG it assigned and to how many holders. Never a holder address. */
export default async function ReceiptsPage() {
  const list = await getReceipts(60).catch(() => []);
  return (
    <div className="pt-4">
      <p className="kicker">Receipts</p>
      <h1 className="display mt-3 text-4xl text-highlight">Every round, on the record.</h1>
      {list.length === 0 ? (
        <p className="mt-6 text-sm text-mist">The first receipt prints when the first vault reaches 0.02 ETH and someone runs its round.</p>
      ) : (
        <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((r) => (
            <li key={`${r.vault}-${r.roundId}`} className="panel p-5">
              <p className="font-mono text-highlight">
                ${r.symbol} · round {r.roundId}
              </p>
              <p className="num mt-3 text-2xl font-semibold text-usdg">{usd(r.usdg)} PAID TO {r.holders} HOLDERS</p>
              <p className="mt-2 text-xs text-dust">{ago(r.at)}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
