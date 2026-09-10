import { Pool, PoolConfig, QueryResult, QueryResultRow } from "pg";
import dotenv from "dotenv";

dotenv.config();

function buildPoolConfig(): PoolConfig {
  if (process.env.DATABASE_URL) {
    return {
      connectionString: process.env.DATABASE_URL,
      ssl:
        process.env.DB_SSL === "true"
          ? { rejectUnauthorized: false }
          : undefined,
    };
  }
  return {
    host: process.env.DB_HOST || "localhost",
    port: parseInt(process.env.DB_PORT || "5432", 10),
    database: process.env.DB_NAME || "pos_db",
    user: process.env.DB_USER || "postgres",
    password: process.env.DB_PASSWORD || "",
    ssl:
      process.env.DB_SSL === "true" ? { rejectUnauthorized: false } : undefined,
  };
}

const poolConfig: PoolConfig = {
  ...buildPoolConfig(),
  max: parseInt(process.env.DB_POOL_MAX || "10", 10),
  min: parseInt(process.env.DB_POOL_MIN || "2", 10),
  idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT || "30000", 10),
  connectionTimeoutMillis: parseInt(
    process.env.DB_CONNECT_TIMEOUT || "8000",
    10,
  ),
  statement_timeout: parseInt(process.env.DB_STATEMENT_TIMEOUT || "15000", 10),
  query_timeout: parseInt(process.env.DB_QUERY_TIMEOUT || "15000", 10),
  keepAlive: true,
};

export const pool = new Pool(poolConfig);

pool.on("connect", () => {
  if (process.env.NODE_ENV !== "production") {
    console.log("[db] pool: new client connected");
  }
});

pool.on("error", (err: Error) => {
  console.error("[db] Unexpected error on idle client", err.message);
});

pool.on("remove", () => {
  if (process.env.NODE_ENV !== "production") {
    console.log("[db] pool: client removed");
  }
});

export async function checkConnection(): Promise<{
  ok: boolean;
  latencyMs?: number;
  error?: string;
}> {
  const start = Date.now();
  try {
    await pool.query("SELECT 1 AS ok");
    return { ok: true, latencyMs: Date.now() - start };
  } catch (err: any) {
    return { ok: false, error: err?.message || String(err) };
  }
}

export async function query<T extends QueryResultRow = any>(
  text: string,
  params?: any[],
): Promise<QueryResult<T>> {
  const start = Date.now();
  try {
    const result = await pool.query<T>(text, params);
    const ms = Date.now() - start;
    if (process.env.DB_LOG === "true" || ms > 1000) {
      console.log(`[db] query ${ms}ms: ${text.slice(0, 120)}`);
    }
    return result;
  } catch (err: any) {
    console.error(`[db] query failed: ${err.message} | ${text.slice(0, 120)}`);
    throw err;
  }
}

export async function withTransaction<T>(
  fn: (client: import("pg").PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    try {
      await client.query("ROLLBACK");
    } catch (_) {}
    throw err;
  } finally {
    client.release();
  }
}

export async function closePool(): Promise<void> {
  await pool.end();
  console.log("[db] pool closed");
}
