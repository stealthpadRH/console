import "server-only";
import { StandardMerkleTree } from "@openzeppelin/merkle-tree";
import type { Address, Hex } from "viem";
import { sql } from "./db";
import { publicClient } from "./chain";
import { vaultAbi } from "./abi";
import { WETH_USDG_POOL } from "./config";

const ZERO = "0x0000000000000000000000000000000000000000";
const DEAD = "0x000000000000000000000000000000000000dead";
const POOL_MANAGER = "0x8366a39cc670b4001a1121b8f6a443a643e40951";
const HOOK = "0xe5e702641ea86f4ae6cc3cdaed2b886f976be044";
const PONS = "0x7ed598bcef8bd9edd8c97a195c6d13f40801ec7e";
const FACTORY_LC = (process.env.NEXT_PUBLIC_FACTORY ?? "").toLowerCase();

const n = (v: unknown) => (v === null || v === undefined ? 0 : Number(v));
const iso = (v: unknown) => (v ? new Date(v as string).toISOString() : null);

// ── prices ─────────────────────────────────────────────────────────────────────

let ethCache: { at: number; usd: number } | null = null;
/** ETH in USDG from the WETH/USDG pool's current price (the same pool every round swaps on). */
export async function ethUsd(): Promise<number> {
  if (ethCache && Date.now() - ethCache.at < 30_000) return ethCache.usd;
  try {
    const slot0 = (await publicClient.readContract({
      address: WETH_USDG_POOL,
      abi: [{ type: "function", name: "slot0", stateMutability: "view", inputs: [], outputs: [{ type: "uint160" }, { type: "int24" }, { type: "uint16" }, { type: "uint16" }, { type: "uint16" }, { type: "uint8" }, { type: "bool" }] }],
      functionName: "slot0",
    })) as readonly [bigint, number, ...unknown[]];
    const usd = Math.pow(1.0001, Number(slot0[1])) * 1e12; // WETH (18) is token0, USDG (6) token1
    ethCache = { at: Date.now(), usd };
    return usd;
  } catch {
    return ethCache?.usd ?? 0;
  }
}

/** Chain time: the head block's timestamp. A fork can run ahead of the wall clock. */
export async function chainNow(): Promise<number> {
  try {
    const b = await publicClient.getBlock({ blockTag: "latest" });
    return Number(b.timestamp);
  } catch {
    return Math.floor(Date.now() / 1000);
  }
}

// ── board ──────────────────────────────────────────────────────────────────────

export type CoinCard = {
  token: Address;
  vault: Address;
  curve: Address;
  launcher: Address;
  taxBps: number;
  name: string;
  symbol: string;
  logo: string;
  description: string;
  website: string;
  social: string;
  launchedAt: string;
  graduated: boolean;
  paidUsdg: number;
  claimedUsdg: number;
  rounds: number;
  lastRoundAt: string | null;
  holders: number;
  vol24Eth: number;
  priceEth: number | null;
  isStealth: boolean;
};

export type BoardStats = { paidUsdg: number; claimedUsdg: number; rounds: number; coins: number; keepers: number; vol24Eth: number; ethUsd: number };

const stealthVault = async () => ((await sql`select value from meta where key = 'stealth_vault'`)[0]?.value as string | undefined) ?? "";

/** Every coin (or one), with its round, claim, volume and holder aggregates. */
async function coinCards(token?: string): Promise<CoinCard[]> {
  const stealth = await stealthVault();
  const rows = await sql`
    select c.*,
      coalesce(r.paid, 0) as paid, coalesce(r.n, 0) as rounds, r.last_at,
      coalesce(cl.claimed, 0) as claimed,
      coalesce(t.vol, 0) as vol24,
      lp.price,
      (select count(*) from balances b where b.token = c.token and b.balance > 0
         and b.holder not in (c.curve, c.vault, c.token, ${ZERO}, ${DEAD}, ${POOL_MANAGER}, ${HOOK})) as holders
    from coins c
    left join (select vault, sum(usdg) as paid, count(*) as n, max(at) as last_at from rounds group by vault) r on r.vault = c.vault
    left join (select vault, sum(amount) as claimed from claims group by vault) cl on cl.vault = c.vault
    left join (select token, sum(eth) as vol from trades where at > now() - interval '24 hours' group by token) t on t.token = c.token
    left join lateral (select eth::numeric / nullif(tokens, 0) as price from trades where token = c.token
                       order by block desc, log_index desc limit 1) lp on true
    ${token ? sql`where c.token = ${token}` : sql``}
    order by c.launched_block desc`;
  return rows.map((r) => ({
    token: r.token,
    vault: r.vault,
    curve: r.curve,
    launcher: r.launcher,
    taxBps: n(r.tax_bps),
    name: r.name,
    symbol: r.symbol,
    logo: r.logo,
    description: r.description,
    website: r.website,
    social: r.social,
    launchedAt: iso(r.launched_at) as string,
    graduated: r.graduated_block !== null,
    paidUsdg: n(r.paid) / 1e6,
    claimedUsdg: n(r.claimed) / 1e6,
    rounds: n(r.rounds),
    lastRoundAt: iso(r.last_at),
    holders: n(r.holders),
    vol24Eth: n(r.vol24) / 1e18,
    priceEth: r.price === null ? null : n(r.price),
    isStealth: r.vault === stealth,
  }));
}

export async function getBoard(): Promise<{ coins: CoinCard[]; stats: BoardStats }> {
  const coins = await coinCards();
  const [agg] = await sql`select coalesce(sum(usdg),0) paid, count(*) rounds, count(distinct caller) keepers from rounds`;
  const [cl] = await sql`select coalesce(sum(amount),0) claimed from claims`;
  const stats: BoardStats = {
    paidUsdg: n(agg.paid) / 1e6,
    claimedUsdg: n(cl.claimed) / 1e6,
    rounds: n(agg.rounds),
    coins: coins.length,
    keepers: n(agg.keepers),
    vol24Eth: coins.reduce((a, c) => a + c.vol24Eth, 0),
    ethUsd: await ethUsd(),
  };
  return { coins, stats };
}

/** The latest rounds across every vault: the board's live strip. */
export async function getLatest(limit = 8) {
  const rows = await sql`
    select r.vault, r.round_id, r.at, r.usdg, c.symbol, c.token,
      (select count(*) from leaves l where l.vault = r.vault and l.round_id = r.round_id and l.share > 0) as holders
    from rounds r join coins c on c.vault = r.vault order by r.at desc, r.round_id desc limit ${limit}`;
  return rows.map((r) => ({ vault: r.vault as Address, roundId: n(r.round_id), at: iso(r.at) as string, usdg: n(r.usdg) / 1e6, symbol: r.symbol as string, token: r.token as Address, holders: n(r.holders) }));
}

// ── one coin ───────────────────────────────────────────────────────────────────

export type RoundRow = {
  roundId: number;
  at: string;
  block: string;
  tx: string;
  caller: Address;
  ethBudget: number;
  usdg: number;
  tip: number;
  toStealth: number;
  toTreasury: number;
  holdersPaid: number | null;
  root: { root: Hex; status: string; activeAt: string } | null;
};

/** Cheap existence check: has the indexer seen this coin yet? */
export async function coinIndexed(token: string): Promise<boolean> {
  const r = await sql`select 1 from coins where token = ${token.toLowerCase()}`;
  return r.length > 0;
}

export type TradeRow = { tx: string; side: "buy" | "sell"; trader: Address; eth: number; tokens: number; venue: string; at: string };
export type HolderRow = { holder: Address; tokens: number; pct: number; lastShareUsdg: number | null; eligible: boolean | null; launcher: boolean };

export async function getCoin(token: string) {
  const t = token.toLowerCase();
  const [coin] = await coinCards(t);
  if (!coin) return null;
  const rounds = await sql`
    select r.*, s.holders as snap_holders,
      (select count(*) from leaves l where l.vault = r.vault and l.round_id = r.round_id and l.share > 0) as paid_holders,
      ro.root, ro.status, ro.active_at
    from rounds r
    left join snapshots s on s.vault = r.vault and s.round_id = r.round_id
    left join lateral (select root, status, active_at from roots x where x.vault = r.vault and x.round_id = r.round_id
                       order by (x.status = 'vetoed') asc, x.posted_block desc limit 1) ro on true
    where r.vault = ${coin.vault}
    order by r.round_id desc limit 200`;
  // the chart needs the most recent trades, oldest first
  const trades = await sql`
    select * from (select extract(epoch from at)::bigint as t, eth, tokens, side, block, log_index from trades where token = ${t}
                   order by block desc, log_index desc limit 5000) x order by block asc, log_index asc`;
  const recent = await sql`select tx, side, trader, eth, tokens, venue, at from trades where token = ${t} order by block desc, log_index desc limit 40`;
  const excluded = [coin.curve, coin.vault, coin.token, ZERO, DEAD, POOL_MANAGER, HOOK, PONS, FACTORY_LC].filter(Boolean);
  const top = await sql`
    select holder, balance from balances where token = ${t} and balance > 0 and holder not in ${sql(excluded)}
    order by balance desc limit 30`;
  const [last] = await sql`select round_id from snapshots where vault = ${coin.vault} order by round_id desc limit 1`;
  const leaves = last
    ? await sql`select holder, share, avg_balance from leaves where vault = ${coin.vault} and round_id = ${last.round_id}`
    : [];
  const byHolder = new Map(leaves.map((l) => [l.holder as string, l]));
  const claims = await sql`select count(*) as n, coalesce(sum(amount),0) as amount from claims where vault = ${coin.vault}`;
  return {
    coin,
    ethUsd: await ethUsd(),
    rounds: rounds.map(
      (r): RoundRow => ({
        roundId: n(r.round_id),
        at: iso(r.at) as string,
        block: String(r.block),
        tx: r.tx,
        caller: r.caller,
        ethBudget: n(r.eth_budget) / 1e18,
        usdg: n(r.usdg) / 1e6,
        tip: n(r.tip) / 1e18,
        toStealth: n(r.to_stealth) / 1e18,
        toTreasury: n(r.to_treasury) / 1e18,
        holdersPaid: r.snap_holders === null ? null : n(r.paid_holders),
        root: r.root ? { root: r.root, status: r.status, activeAt: iso(r.active_at) as string } : null,
      }),
    ),
    trades: trades.map((x) => ({ t: n(x.t), price: n(x.eth) / Math.max(1, n(x.tokens)), eth: n(x.eth) / 1e18, side: x.side as string })),
    recent: recent.map(
      (x): TradeRow => ({ tx: x.tx, side: x.side, trader: x.trader, eth: n(x.eth) / 1e18, tokens: n(x.tokens) / 1e18, venue: x.venue, at: iso(x.at) as string }),
    ),
    holders: top.map((h): HolderRow => {
      const l = byHolder.get(h.holder);
      return {
        holder: h.holder,
        tokens: n(h.balance) / 1e18,
        pct: (n(h.balance) / 1e18 / 1_000_000_000) * 100,
        lastShareUsdg: l ? n(l.share) / 1e6 : last ? 0 : null,
        eligible: l ? n(l.avg_balance) / 1e18 >= 100_000 : last ? false : null,
        launcher: h.holder === coin.launcher,
      };
    }),
    lastSnapshotRound: last ? n(last.round_id) : null,
    claims: { count: n(claims[0].n), usdg: n(claims[0].amount) / 1e6 },
  };
}

// ── receipts ───────────────────────────────────────────────────────────────────

export async function getReceipts(limit = 60) {
  const rows = await sql`
    select r.vault, r.round_id, r.at, r.tx, r.caller, r.usdg, r.eth_budget, r.tip, c.symbol, c.name, c.logo, c.token, c.tax_bps,
      (select count(*) from leaves l where l.vault = r.vault and l.round_id = r.round_id and l.share > 0) as holders
    from rounds r join coins c on c.vault = r.vault
    order by r.at desc, r.round_id desc limit ${limit}`;
  return rows.map((r) => ({
    vault: r.vault as Address,
    roundId: n(r.round_id),
    at: iso(r.at) as string,
    tx: r.tx as string,
    caller: r.caller as Address,
    usdg: n(r.usdg) / 1e6,
    ethBudget: n(r.eth_budget) / 1e18,
    tip: n(r.tip) / 1e18,
    symbol: r.symbol as string,
    name: r.name as string,
    logo: r.logo as string,
    token: r.token as Address,
    taxBps: n(r.tax_bps),
    holders: n(r.holders),
  }));
}

export async function getReceipt(vault: string, roundId: number) {
  const all = await sql`
    select r.vault, r.round_id, r.at, r.tx, r.block, r.caller, r.usdg, r.eth_budget, r.tip, r.to_stealth, r.to_treasury,
      c.symbol, c.name, c.logo, c.token, c.tax_bps,
      (select count(*) from leaves l where l.vault = r.vault and l.round_id = r.round_id and l.share > 0) as holders,
      s.window_from, s.window_to, s.sampled_blocks, s.distributed, s.carry, s.holders as eligible, s.leaf_hash, s.root as snap_root,
      ro.root, ro.status, ro.active_at, ro.tx as root_tx, ro.total as root_total
    from rounds r join coins c on c.vault = r.vault
    left join snapshots s on s.vault = r.vault and s.round_id = r.round_id
    left join lateral (select root, status, active_at, tx, total from roots x where x.vault = r.vault and x.round_id = r.round_id
                       order by (x.status = 'vetoed') asc, x.posted_block desc limit 1) ro on true
    where r.vault = ${vault.toLowerCase()} and r.round_id = ${roundId}`;
  const r = all[0];
  if (!r) return null;
  const budget = n(r.eth_budget) / 1e18;
  const tip = n(r.tip) / 1e18;
  const toStealth = n(r.to_stealth) / 1e18;
  const toTreasury = n(r.to_treasury) / 1e18;
  return {
    vault: r.vault as Address, roundId: n(r.round_id), at: iso(r.at) as string, tx: r.tx as string, block: String(r.block), caller: r.caller as Address,
    usdg: n(r.usdg) / 1e6, ethBudget: budget, tip, toStealth, toTreasury, holdersEth: Math.max(0, budget - tip - toStealth - toTreasury),
    symbol: r.symbol as string, name: r.name as string, logo: r.logo as string, token: r.token as Address, taxBps: n(r.tax_bps), holders: n(r.holders),
    snapshot: r.leaf_hash
      ? {
          windowFrom: String(r.window_from), windowTo: String(r.window_to), samples: (r.sampled_blocks as (string | number)[]).map(String),
          eligible: n(r.eligible), distributedUsdg: n(r.distributed) / 1e6, carryRaw: String(r.carry), leafHash: r.leaf_hash as string,
        }
      : null,
    root: r.root ? { root: r.root as Hex, status: r.status as string, activeAt: iso(r.active_at) as string, tx: r.root_tx as string, totalUsdg: n(r.root_total) / 1e6 } : null,
  };
}

// ── keepers ────────────────────────────────────────────────────────────────────

export async function getKeepers() {
  const rows = await sql`
    select caller, count(*) as rounds, sum(tip) as tips, count(distinct vault) as coins, min(at) as first_at, max(at) as last_at,
      sum(case when round_id = 1 then 1 else 0 end) as firsts,
      array_agg(distinct (at at time zone 'utc')::date order by (at at time zone 'utc')::date desc) as days
    from rounds group by caller order by count(*) desc, sum(tip) desc limit 100`;
  const today = new Date().toISOString().slice(0, 10);
  return rows.map((r) => {
    const days = (r.days as (string | Date)[]).map((d) => new Date(d).toISOString().slice(0, 10));
    let streak = 0;
    const cur = new Date(today + "T00:00:00Z");
    if (days[0] !== today) cur.setUTCDate(cur.getUTCDate() - 1);
    for (const d of days) {
      if (d === cur.toISOString().slice(0, 10)) {
        streak++;
        cur.setUTCDate(cur.getUTCDate() - 1);
      } else if (d < cur.toISOString().slice(0, 10)) break;
    }
    return {
      caller: r.caller as Address,
      rounds: n(r.rounds),
      tipsEth: n(r.tips) / 1e18,
      coins: n(r.coins),
      firsts: n(r.firsts),
      streak,
      lastAt: iso(r.last_at) as string,
    };
  });
}

// ── claims ─────────────────────────────────────────────────────────────────────

export type Claimable = {
  token: Address;
  vault: Address;
  symbol: string;
  name: string;
  logo: string;
  active: { roundId: number; cumulative: string; proof: Hex[]; root: Hex } | null;
  pending: { roundId: number; cumulative: string; activeAt: string } | null;
  claimed: string;
  claimable: string;
};

/** Everything a wallet can claim, with Merkle proofs, from the roots the vaults actually hold. */
export async function getClaimables(wallet: string): Promise<Claimable[]> {
  const w = wallet.toLowerCase();
  const now = new Date((await chainNow()) * 1000);
  const rows = await sql`
    with live as (
      select vault, round_id, root, active_at,
        case when status = 'active' or (status = 'pending' and active_at <= ${now}) then 'active' else status end as st
      from roots where status <> 'vetoed'
    ),
    act as (select distinct on (vault) vault, round_id, root from live where st = 'active' order by vault, round_id desc),
    pend as (select distinct on (vault) vault, round_id, root, active_at from live where st = 'pending' order by vault, round_id desc)
    select c.token, c.vault, c.symbol, c.name, c.logo,
      a.round_id as a_round, a.root as a_root, la.cumulative as a_cum, s.tree as a_tree,
      p.round_id as p_round, p.active_at as p_at, lp.cumulative as p_cum
    from coins c
    left join act a on a.vault = c.vault
    left join leaves la on la.vault = c.vault and la.round_id = a.round_id and la.holder = ${w}
    left join snapshots s on s.vault = c.vault and s.round_id = a.round_id
    left join pend p on p.vault = c.vault
    left join leaves lp on lp.vault = c.vault and lp.round_id = p.round_id and lp.holder = ${w}
    where la.cumulative is not null or lp.cumulative is not null
    order by c.launched_block desc`;
  if (!rows.length) return [];
  const claimed = await publicClient.multicall({
    contracts: rows.map((r) => ({ address: r.vault as Address, abi: vaultAbi, functionName: "claimed" as const, args: [w as Address] })),
    allowFailure: true,
  });
  return rows.map((r, i) => {
    const got = claimed[i].status === "success" ? (claimed[i].result as bigint) : 0n;
    let active: Claimable["active"] = null;
    if (r.a_cum !== null && r.a_tree) {
      const tree = StandardMerkleTree.load(r.a_tree);
      if (tree.root.toLowerCase() === String(r.a_root).toLowerCase()) {
        const cum = String(r.a_cum);
        for (const [j, v] of tree.entries()) {
          if (String(v[0]).toLowerCase() === w && String(v[1]) === cum) {
            active = { roundId: n(r.a_round), cumulative: cum, proof: tree.getProof(j) as Hex[], root: r.a_root };
            break;
          }
        }
      }
    }
    const pending = r.p_cum !== null ? { roundId: n(r.p_round), cumulative: String(r.p_cum), activeAt: iso(r.p_at) as string } : null;
    const claimable = active && BigInt(active.cumulative) > got ? BigInt(active.cumulative) - got : 0n;
    return {
      token: r.token,
      vault: r.vault,
      symbol: r.symbol,
      name: r.name,
      logo: r.logo,
      active,
      pending,
      claimed: got.toString(),
      claimable: claimable.toString(),
    };
  });
}

/** A holder's $STEALTH weight from the latest $STEALTH snapshot (time-weighted), as % of supply. */
export async function stealthWeightPct(wallet: string): Promise<number | null> {
  const stealth = (await sql`select value from meta where key = 'stealth_vault'`)[0]?.value;
  if (!stealth) return null;
  const r = await sql`select avg_balance from leaves where vault = ${stealth} and holder = ${wallet.toLowerCase()} order by round_id desc limit 1`;
  if (!r.length) return 0;
  return (n(r[0].avg_balance) / 1e18 / 1_000_000_000) * 100;
}

export async function getClaimHistory(wallet: string) {
  const rows = await sql`
    select cl.tx, cl.at, cl.amount, cl.fee, cl.to_addr, cl.holder, c.symbol, c.token
    from claims cl join coins c on c.vault = cl.vault
    where cl.holder = ${wallet.toLowerCase()} order by cl.at desc limit 50`;
  return rows.map((r) => ({
    tx: r.tx as string,
    at: iso(r.at) as string,
    usdg: n(r.amount) / 1e6,
    fee: n(r.fee) / 1e6,
    routed: r.to_addr !== r.holder,
    symbol: r.symbol as string,
    token: r.token as Address,
  }));
}

export async function getLeafFile(vault: string, roundId: number) {
  const r = await sql`select file, leaf_hash from snapshots where vault = ${vault.toLowerCase()} and round_id = ${roundId}`;
  return r[0] ? { file: r[0].file as string, hash: r[0].leaf_hash as string } : null;
}

export async function health() {
  const m = await sql`select key, value from meta where key in ('cursor', 'heartbeat')`;
  const o = Object.fromEntries(m.map((x) => [x.key, x.value]));
  return { cursor: o.cursor ?? null, heartbeat: o.heartbeat ?? null };
}
