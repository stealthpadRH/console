"use client";
import Link from "next/link";
import type { ReactNode } from "react";
import { DOCS_URL, IS_FORK, LIVE, LP_URL } from "../lib/config";
import { short } from "../lib/fmt";
import { useWallet } from "./wallet";

const NAV = [
  { href: "/", label: "Board" },
  { href: "/launch", label: "Launch" },
  { href: "/claim", label: "Claim" },
  { href: "/keeper", label: "Keepers" },
  { href: "/receipts", label: "Receipts" },
];

export function Shell({ children }: { children: ReactNode }) {
  const { account, connect, busy, error } = useWallet();
  return (
    <>
      {IS_FORK ? (
        <p className="banner">Fork rehearsal. Nothing here is on Robinhood Chain mainnet.</p>
      ) : !LIVE ? (
        <p className="banner">Pre-launch. The StealthFactory is not on Robinhood Chain yet: $STEALTH launches first, then this board fills.</p>
      ) : null}
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-4">
        <Link href="/" className="display text-lg text-highlight">
          Stealthpad
        </Link>
        <nav className="hidden gap-5 text-sm text-mist sm:flex">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className="hover:text-glass-bright">
              {n.label}
            </Link>
          ))}
          <a href={DOCS_URL} className="hover:text-glass-bright">
            Docs
          </a>
        </nav>
        <button type="button" className="btn btn-sm" onClick={() => connect()} disabled={busy}>
          {account ? short(account) : busy ? "Connecting" : "Connect"}
        </button>
      </header>
      {error ? <p className="mx-auto max-w-6xl px-4 text-sm text-risk">{error}</p> : null}
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-16">{children}</main>
      <footer className="mx-auto w-full max-w-6xl px-4 py-8 text-xs text-dust">
        <p>
          The vault has no keys. Not ours, not the dev&apos;s. · <a href={LP_URL}>stealthpad.online</a> · The $STEALTH contract address is published on
          launch day through official channels only.
        </p>
      </footer>
    </>
  );
}
