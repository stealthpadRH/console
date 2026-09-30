import type { Address } from "viem";

// Public, build-time configuration. Every NEXT_PUBLIC_* value is read with a direct reference so the
// bundler inlines it (bracket access would silently read "" in the browser).
const _CHAIN_ID = process.env.NEXT_PUBLIC_CHAIN_ID;
const _RPC = process.env.NEXT_PUBLIC_RPC_URL;
const _FACTORY = process.env.NEXT_PUBLIC_FACTORY;
const _START = process.env.NEXT_PUBLIC_FACTORY_BLOCK;

export const CHAIN_ID = Number(_CHAIN_ID || 4663);
export const IS_FORK = CHAIN_ID !== 4663;
export const RPC_URL = _RPC || "https://rpc.mainnet.chain.robinhood.com";
export const FACTORY = (_FACTORY || "") as Address;
export const FACTORY_BLOCK = BigInt(_START || "0");
export const LIVE = Boolean(FACTORY);

export const CHAIN_NAME = IS_FORK ? `Robinhood fork ${CHAIN_ID}` : "Robinhood Chain";
export const EXPLORER = "https://robin.etherscan.io";
export const LP_URL = "https://stealthpad.online";
export const DOCS_URL = "https://stealthpad.online/docs";
export const PONS_URL = "https://www.ponsfamily.com";

export const USDG = "0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168" as Address;
export const WETH_USDG_POOL = "0x52e65B17fB6E5BA00Ed806f37Afcd2DaA50271Ca" as Address;
export const PONS = "0x7eD598BcEf8bd9Edd8C97A195C6d13f40801EC7e" as Address;
export const MULTICALL3 = "0xcA11bde05977b3631167028862bE2a173976CA11" as Address;

// The vault's constants, mirrored for display. The contract is the source of truth.
export const MIN_ROUND_WEI = 20_000_000_000_000_000n; // 0.02 ETH
export const COOLDOWN_S = 3600;
export const ROOT_DELAY_S = 7200;
export const SPLIT = { holders: 0.92, caller: 0.03, stealth: 0.025, treasury: 0.025 } as const;
export const PONS_CREATOR_FEE_SHARE = 0.007; // 70% of Pons V2's 1% trading fee, snapshotted per coin at launch
export const SUPPLY = 1_000_000_000;
export const ELIGIBILITY_FLOOR = 100_000;

export const TIERS = [
  { id: "visitor", label: "Visitor", minPct: 0, feeBps: 20 },
  { id: "holder", label: "Holder", minPct: 0.05, feeBps: 10 },
  { id: "keeper", label: "Keeper-plus", minPct: 0.2, feeBps: 0 },
  { id: "core", label: "Core", minPct: 1, feeBps: 0 },
] as const;

export const explorerTx = (h: string) => `${EXPLORER}/tx/${h}`;
export const explorerAddress = (a: string) => `${EXPLORER}/address/${a}`;
export const explorerToken = (a: string) => `${EXPLORER}/token/${a}`;
