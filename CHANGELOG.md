# Changelog

All notable changes to Stealthpad Console are recorded here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Planned
- Set `NEXT_PUBLIC_FACTORY` and `NEXT_PUBLIC_FACTORY_BLOCK` on mainnet day; the pre-launch banner lifts on its own.
- Milestone cards at $1k, $10k and $100k paid per coin; rounds-held badges at 10, 50 and 100.
- Analytics page and automated receipts (Phase 2); claim widget (Phase 3).

## [0.1.0] - 2026-09-29

### Added
- Next.js 16.3.7 app router with React 19.2.8, viem 2.56.9 and Tailwind 4.
- Pages: board, launch, coin, claim, keeper, receipts.
- Claim flow with USDG, Zcash (transparent address) and Aleo routes; NEAR Intents quotes requested from the browser; Zcash base58check and Aleo bech32m checksum validation before any quote.
- Keeper page reading `roundReady()` and `pendingEth()` from every vault by multicall, with a Run round button.
- Pre-launch mode driven by an empty `NEXT_PUBLIC_FACTORY`.
- Public read API routes and logo upload with type, size, pixel and per-IP limits.
- Multi-stage Dockerfile: standalone output, unprivileged `node` user, health check.
