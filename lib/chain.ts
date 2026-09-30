import { createPublicClient, defineChain, http } from "viem";
import { CHAIN_ID, CHAIN_NAME, EXPLORER, MULTICALL3, RPC_URL } from "./config";

export const chain = defineChain({
  id: CHAIN_ID,
  name: CHAIN_NAME,
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: [RPC_URL] } },
  blockExplorers: { default: { name: "Etherscan", url: EXPLORER } },
  contracts: { multicall3: { address: MULTICALL3 } },
});

// The public RPC answers browsers (CORS *) but turns away server requests without a browser-like UA.
export const publicClient = createPublicClient({
  chain,
  transport: http(RPC_URL, {
    timeout: 20_000,
    retryCount: 2,
    fetchOptions: typeof window === "undefined" ? { headers: { "user-agent": "Mozilla/5.0 (stealthpad-app)" } } : undefined,
  }),
  batch: { multicall: { wait: 16 } },
  cacheTime: 0,
});
