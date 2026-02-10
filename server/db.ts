import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "@shared/schema";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Connection pool configuration optimized for 2000+ concurrent users
const poolConfig = {
  connectionString: process.env.DATABASE_URL,
  // Maximum number of clients in the pool
  max: 50,
  // Minimum number of idle clients maintained
  min: 10,
  // How long a client can sit idle before being closed (30 seconds)
  idleTimeoutMillis: 30000,
  // How long to wait for a connection (10 seconds)
  connectionTimeoutMillis: 10000,
  // Maximum times a connection can be reused
  maxUses: 7500,
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
