import type { Metadata } from "next";
import { LaunchForm } from "../../components/LaunchForm";
import { ethUsd } from "../../lib/data";

export const metadata: Metadata = { title: "Launch a coin" };
export const dynamic = "force-dynamic";

export default async function LaunchPage() {
  const price = await ethUsd().catch(() => 0);
  return <LaunchForm ethUsd={price} />;
}
