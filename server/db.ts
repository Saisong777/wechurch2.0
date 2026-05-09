import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "@shared/schema";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

function envNumber(name: string, fallback: number, min: number, max: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  if (Number.isNaN(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

// Railway Postgres plans can have fairly small connection limits. Keep the
// default pool conservative and let production scale it explicitly with env vars.
const poolConfig = {
  connectionString: process.env.DATABASE_URL,
  max: envNumber("DB_POOL_MAX", 20, 1, 50),
  min: envNumber("DB_POOL_MIN", 0, 0, 10),
  idleTimeoutMillis: envNumber("DB_POOL_IDLE_TIMEOUT_MS", 30000, 5000, 120000),
  connectionTimeoutMillis: envNumber("DB_POOL_CONNECTION_TIMEOUT_MS", 5000, 1000, 30000),
  maxUses: envNumber("DB_POOL_MAX_USES", 5000, 500, 20000),
};

export const pool = new Pool(poolConfig);

// Connection pool event handlers for monitoring
pool.on('error', (err) => {
  console.error('[DB Pool] Unexpected error on idle client:', err.message);
});

pool.on('connect', () => {
  console.log('[DB Pool] New client connected');
});

// Get current pool statistics
export function getPoolStats() {
  return {
    totalCount: pool.totalCount,
    idleCount: pool.idleCount,
    waitingCount: pool.waitingCount,
  };
}

export const db = drizzle(pool, { schema });
