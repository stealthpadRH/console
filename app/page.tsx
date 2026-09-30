import { getBoard, getLatest } from "../lib/data";
import { BoardView } from "../components/BoardView";

export const dynamic = "force-dynamic";

/** The board: every coin, its vault, and PAID TO HOLDERS. */
export default async function BoardPage() {
  const [data, latest] = await Promise.all([getBoard().catch(() => null), getLatest().catch(() => [])]);
  return <BoardView initial={data ? { ...data, latest } : null} />;
}
