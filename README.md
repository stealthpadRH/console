<div align="center">

# Stealthpad Console

**The app at [app.stealthpad.online](https://app.stealthpad.online): launch a coin, watch its vault, run rounds, claim your share.**

*Every trade tops up a vault nobody holds the keys to.*

[![App](https://img.shields.io/badge/app-pre--launch-77D6A8?style=flat-square)](https://app.stealthpad.online)
[![Next.js](https://img.shields.io/badge/Next.js-16.3.7-05110F?style=flat-square)](https://nextjs.org)
[![React](https://img.shields.io/badge/React-19.2.8-299867?style=flat-square)](https://react.dev)
[![viem](https://img.shields.io/badge/viem-2.56.9-34B27B?style=flat-square)](https://viem.sh)
[![Container](https://img.shields.io/badge/container-non--root-176945?style=flat-square)](./Dockerfile)

</div>

---

> **Pre-launch mode.** The app runs against Robinhood Chain mainnet, but the StealthFactory is not deployed yet. A banner says so, the board is empty, and the launch form stays closed until mainnet day, when $STEALTH launches first.

## Pages

| Route | Page | What it does |
|---|---|---|
| `/` | Board | Every coin with PAID TO HOLDERS as its biggest number, a pad-wide counter, and the latest rounds. Refreshes every 15 seconds |
| `/launch` | Launch | Name, ticker, logo, website, creator tax 1 to 5% (fixed forever), optional first buy. Shows what holders would receive at three daily volumes and the predicted vault address. One signature |
| `/coin/[token]` | Coin | The coin's vault, PAID TO HOLDERS, every round with its root status (pending, active, vetoed) |
| `/claim` | Claim | Claimable USDG per coin with the $STEALTH tier applied. Routes: USDG to the same wallet, Zcash to a transparent address, USDCx or USAD on Aleo. Route quotes run in the browser only |
| `/keeper` | Keepers | Vaults ready for a round, read live from the chain, with a Run round button that pays the caller 3%. Leaderboard: rounds, tips, coins, first rounds, streaks |
| `/receipts` | Receipts | One card per round: "$X PAID TO N HOLDERS", never a holder address |

The app also serves the public read API (`/api/board`, `/api/coin/:token`, `/api/claimable`, `/api/leaves/:vault/:round`, `/api/health`) and the launch-form logo upload (`/api/upload`, `/img/:file`). The reference is in [stealthpad-conduit/ENDPOINTS.md](../stealthpad-conduit/ENDPOINTS.md).

## Screenshots

| Board | Claim | Keepers |
|---|---|---|
| `docs/screenshots/board.png` (to be added at launch) | `docs/screenshots/claim.png` (to be added at launch) | `docs/screenshots/keeper.png` (to be added at launch) |

## Structure

```
app/
├── page.tsx                  board (server component, reads the index)
├── launch/page.tsx           launch form
├── coin/[token]/page.tsx     one coin
├── claim/page.tsx            claim with routes
├── keeper/page.tsx           ready rounds + leaderboard
├── receipts/page.tsx         round receipts
├── api/                      public read API + logo upload
└── img/[file]/route.ts       re-encoded logos
components/                   BoardView, ClaimView, KeeperView, LaunchForm, Shell, wallet
lib/
├── config.ts                 public build-time config and vault constants (mirrored for display)
├── chain.ts                  viem chain + public client for Robinhood Chain (4663)
├── abi.ts                    factory, vault and Pons surfaces the app calls
├── data.ts                   server-only reads from the indexer database and the chain
├── routes.ts                 payout routes, Zcash base58check and Aleo bech32m validators
├── oneclick.ts               NEAR Intents 1Click quote and status, browser only
├── ratelimit.ts              soft per-IP limit for RPC fan-out routes
└── db.ts, fmt.ts
```

## Setup

Requirements: Node 22 or later, a Postgres database filled by the indexer in [stealthpad-warden](../stealthpad-warden).

```bash
git clone https://github.com/stealthpadRH/stealthpad-console.git
cd stealthpad-console
cp .env.example .env.local      # fill DATABASE_URL; leave NEXT_PUBLIC_FACTORY empty for pre-launch mode
npm install
npm run dev                     # http://localhost:3000
```

| Script | Command | Purpose |
|---|---|---|
| `dev` | `next dev` | Local development with hot reload |
| `build` | `next build` | Production build, standalone output |
| `start` | `next start` | Serve the production build |
| `typecheck` | `tsc --noEmit` | Strict type check |

## Environment

| Variable | Scope | Default | Notes |
|---|---|---|---|
| `NEXT_PUBLIC_CHAIN_ID` | public, build time | `4663` | Anything else puts the app in fork mode with a banner |
| `NEXT_PUBLIC_RPC_URL` | public, build time | `https://rpc.mainnet.chain.robinhood.com` | Browser and server reads |
| `NEXT_PUBLIC_FACTORY` | public, build time | empty | Empty means pre-launch mode |
| `NEXT_PUBLIC_FACTORY_BLOCK` | public, build time | empty | The factory's deployment block |
| `NEXT_PUBLIC_APP_URL` | public, build time | `https://app.stealthpad.online` | Absolute URLs for uploaded logos |
| `DATABASE_URL` | **server only, runtime** | none | Read access to the indexer database |

**`NEXT_PUBLIC_*` values are public.** Next.js inlines them into the browser bundle at build time, where anyone can read them. They hold chain configuration and contract addresses only. Never put a key, a password or a connection string in a `NEXT_PUBLIC_*` variable. `DATABASE_URL` is passed to the running container, never as a build argument.

## Deploy

The [Dockerfile](./Dockerfile) builds a Next.js standalone server in three stages and runs it as the unprivileged `node` user.

```bash
docker build -t stealthpad-console \
  --build-arg NEXT_PUBLIC_FACTORY=0x... \
  --build-arg NEXT_PUBLIC_FACTORY_BLOCK=... .

docker run -d --name stealthpad-console -p 3000:3000 \
  --read-only --tmpfs /tmp --tmpfs /app/.next/cache --security-opt no-new-privileges \
  --env-file ./runtime.env stealthpad-console      # runtime.env holds DATABASE_URL only

docker exec stealthpad-console id                  # must not be uid=0
```

Deployment checklist:

- Run as non-root and confirm with `id` after every deploy; fix it in the Dockerfile, never in a running container.
- Never mount the Docker socket into this container.
- Put the app behind a TLS-terminating reverse proxy that sets `x-forwarded-for` or `x-real-ip`, so per-IP limits see the client.
- Verify no secret reached the bundle: `grep -rl -- '<value>' .next/static` must return nothing.
- Keep `next`, `react` and `viem` on current patch releases; enable automated dependency update alerts.
- Fork rehearsal tooling from the development tree is not part of this repository and must never be deployed.

## Security

The app holds no key of any kind. Wallet connection and every signature happen in the user's wallet. A claim is one transaction to the coin's vault and never needs a token approval or a seed phrase. Payout destinations for Zcash and Aleo go from the browser to NEAR Intents directly and never reach this server. See [stealthpad-dossier/THREAT_MODEL.md](../stealthpad-dossier/THREAT_MODEL.md).

## Related

| Repository | Contents |
|---|---|
| [stealthpad-foundry](../stealthpad-foundry) | StealthFactory and StealthVault |
| [stealthpad-warden](../stealthpad-warden) | Indexer, attester, keeper, verifier that fill the database |
| [stealthpad-conduit](../stealthpad-conduit) | API reference and TypeScript SDK |
| [stealthpad-dossier](../stealthpad-dossier) | Thesis, threat model, privacy scope |

---

<div align="center">
<sub>Stealthpad is experimental software on public blockchains. $STEALTH and every coin launched through Stealthpad are digital tokens with no promise of value, profit or return. Payouts depend on trading volume, which can fall to zero. The $STEALTH contract address is published on launch day through official channels only. Stealthpad is independent and is not affiliated with Robinhood, Pons, NEAR, or the Zcash and Aleo foundations.</sub>
</div>
