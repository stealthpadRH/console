import type { Metadata } from "next";
import { ClaimView } from "../../components/ClaimView";

export const metadata: Metadata = { title: "Claim" };

/** Claim as USDG, Zcash or Aleo dollars. Route quotes run in the holder's browser only. */
export default function ClaimPage() {
  return <ClaimView />;
}
