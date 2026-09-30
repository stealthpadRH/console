"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { BaseError, ContractFunctionRevertedError, createWalletClient, custom, type Abi, type Address, type Hex } from "viem";
import { chain, publicClient } from "../lib/chain";
import { CHAIN_ID, CHAIN_NAME, EXPLORER, RPC_URL } from "../lib/config";

type Eip1193 = {
  request: (a: { method: string; params?: unknown[] }) => Promise<unknown>;
  on?: (ev: string, fn: (...a: unknown[]) => void) => void;
  removeListener?: (ev: string, fn: (...a: unknown[]) => void) => void;
};
declare global {
  interface Window {
    ethereum?: Eip1193;
  }
}

export type WriteParams = { address: Address; abi: Abi; functionName: string; args?: readonly unknown[]; value?: bigint };

type Ctx = {
  account: Address | null;
  chainOk: boolean;
  busy: boolean;
  error: string | null;
  connect: () => Promise<Address | null>;
  /** Switches to Robinhood Chain if needed, simulates, then sends. Resolves after the receipt. */
  write: (p: WriteParams) => Promise<Hex>;
};

const WalletCtx = createContext<Ctx | null>(null);

/** Human text for a failed call: the contract's own error name first, then the wallet's message. */
export function explain(e: unknown): string {
  if (e instanceof BaseError) {
    const rev = e.walk((x) => x instanceof ContractFunctionRevertedError) as ContractFunctionRevertedError | null;
    const map: Record<string, string> = {
      CoolingDown: "This coin ran a round less than an hour ago.",
      BelowMinimum: "The vault holds less than 0.02 ETH, so there is no round to run yet.",
      NothingToClaim: "Nothing new to claim from this vault.",
      BadProof: "That proof does not match the vault's active root. Refresh and try again.",
      FeeTooHigh: "The route fee is above the vault's cap.",
      BadRecipient: "That recipient is not allowed.",
      SwapOutTooLow: "The pool price moved too far from its 30-minute average. Try again in a few minutes.",
      TipFailed: "Your wallet refused the tip payment.",
    };
    const name = rev?.data?.errorName;
    if (name) return map[name] ?? `The contract refused: ${name}.`;
    const msg = e.shortMessage || e.message;
    if (/user rejected|denied/i.test(msg)) return "Cancelled in the wallet.";
    return msg.split("\n")[0].slice(0, 180);
  }
  return (e instanceof Error ? e.message : String(e)).split("\n")[0].slice(0, 180);
}

const hex = (n: number) => `0x${n.toString(16)}`;

export function WalletProvider({ children }: { children: ReactNode }) {
  const [account, setAccount] = useState<Address | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const p = window.ethereum;
    if (!p?.on) return;
    const onAcc = (...a: unknown[]) => setAccount(((a[0] as string[])[0] as Address) ?? null);
    const onChain = (...a: unknown[]) => setChainId(Number(a[0]));
    p.on("accountsChanged", onAcc);
    p.on("chainChanged", onChain);
    return () => {
      p.removeListener?.("accountsChanged", onAcc);
      p.removeListener?.("chainChanged", onChain);
    };
  }, []);

  const connect = useCallback(async () => {
    setError(null);
    const p = window.ethereum;
    if (!p) {
      setError("No wallet found in this browser. Open this page in your wallet's browser, or install one.");
      return null;
    }
    setBusy(true);
    try {
      const accs = (await p.request({ method: "eth_requestAccounts" })) as string[];
      setAccount((accs[0] as Address) ?? null);
      setChainId(Number(await p.request({ method: "eth_chainId" })));
      return (accs[0] as Address) ?? null;
    } catch (e) {
      setError(explain(e));
      return null;
    } finally {
      setBusy(false);
    }
  }, []);

  const ensureChain = useCallback(async (p: Eip1193) => {
    if (Number(await p.request({ method: "eth_chainId" })) === CHAIN_ID) return;
    try {
      await p.request({ method: "wallet_switchEthereumChain", params: [{ chainId: hex(CHAIN_ID) }] });
    } catch {
      await p.request({
        method: "wallet_addEthereumChain",
        params: [{ chainId: hex(CHAIN_ID), chainName: CHAIN_NAME, nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 }, rpcUrls: [RPC_URL], blockExplorerUrls: [EXPLORER] }],
      });
    }
    setChainId(CHAIN_ID);
  }, []);

  const write = useCallback(
    async (w: WriteParams) => {
      const p = window.ethereum;
      const from = account ?? (await connect());
      if (!p || !from) throw new Error("Connect a wallet first.");
      await ensureChain(p);
      const wallet = createWalletClient({ chain, transport: custom(p), account: from });
      // simulate first, so a revert is explained before the wallet opens
      const { request } = await publicClient.simulateContract({ ...w, account: from } as never);
      const hash = await wallet.writeContract(request as never);
      await publicClient.waitForTransactionReceipt({ hash });
      return hash;
    },
    [account, connect, ensureChain],
  );

  const value = useMemo<Ctx>(() => ({ account, chainOk: chainId === CHAIN_ID, busy, error, connect, write }), [account, chainId, busy, error, connect, write]);
  return <WalletCtx.Provider value={value}>{children}</WalletCtx.Provider>;
}

export function useWallet(): Ctx {
  const c = useContext(WalletCtx);
  if (!c) throw new Error("useWallet outside WalletProvider");
  return c;
}
