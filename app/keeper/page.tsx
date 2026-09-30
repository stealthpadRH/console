import type { Metadata } from "next";
import { getBoard, getKeepers } from "../../lib/data";
import { KeeperView } from "../../components/KeeperView";

export const metadata: Metadata = { title: "Keepers" };
export const dynamic = "force-dynamic";

/** Ready rounds (read live from each vault) and the keeper leaderboard. */
export default async function KeeperPage() {
  const [board, keepers] = await Promise.all([getBoard().catch(() => null), getKeepers().catch(() => [])]);
  return <KeeperView coins={board?.coins ?? []} ethUsd={board?.stats.ethUsd ?? 0} keepers={keepers} />;
}
