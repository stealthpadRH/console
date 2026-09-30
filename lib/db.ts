import "server-only";
import postgres from "postgres";

// Server-only, runtime configuration. DATABASE_URL is never a build argument and never NEXT_PUBLIC_*.
// One pool per server process (Next dev reloads modules; keep the pool on globalThis).
// Without it, the local default below is used (a development database with no password).
const url = process.env.DATABASE_URL;

const g = globalThis as unknown as { __sql?: postgres.Sql };
export const sql =
  g.__sql ??
  (g.__sql = postgres(url || "postgres://stealthpad@127.0.0.1:5432/stealthpad", {
    max: 6,
    idle_timeout: 30,
    onnotice: () => {},
  }));
