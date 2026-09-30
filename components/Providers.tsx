"use client";
import type { ReactNode } from "react";
import { WalletProvider } from "./wallet";
import { Shell } from "./Shell";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <WalletProvider>
      <Shell>{children}</Shell>
    </WalletProvider>
  );
}
