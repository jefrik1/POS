"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.pool = void 0;
exports.checkConnection = checkConnection;
exports.query = query;
exports.withTransaction = withTransaction;
exports.closePool = closePool;
const pg_1 = require("pg");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
function buildPoolConfig() {
    if (process.env.DATABASE_URL) {
        return {
            connectionString: process.env.DATABASE_URL,
            ssl: process.env.DB_SSL === "true"
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
        ssl: process.env.DB_SSL === "true" ? { rejectUnauthorized: false } : undefined,
    };
}
const poolConfig = {
    ...buildPoolConfig(),
    max: parseInt(process.env.DB_POOL_MAX || "10", 10),
    min: parseInt(process.env.DB_POOL_MIN || "2", 10),
    idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT || "30000", 10),
    connectionTimeoutMillis: parseInt(process.env.DB_CONNECT_TIMEOUT || "8000", 10),
    statement_timeout: parseInt(process.env.DB_STATEMENT_TIMEOUT || "15000", 10),
    query_timeout: parseInt(process.env.DB_QUERY_TIMEOUT || "15000", 10),
    keepAlive: true,
};
exports.pool = new pg_1.Pool(poolConfig);
exports.pool.on("connect", () => {
    if (process.env.NODE_ENV !== "production") {
        console.log("[db] pool: new client connected");
    }
});
exports.pool.on("error", (err) => {
    console.error("[db] Unexpected error on idle client", err.message);
});
exports.pool.on("remove", () => {
    if (process.env.NODE_ENV !== "production") {
        console.log("[db] pool: client removed");
    }
});
async function checkConnection() {
    const start = Date.now();
    try {
        await exports.pool.query("SELECT 1 AS ok");
        return { ok: true, latencyMs: Date.now() - start };
    }
    catch (err) {
        return { ok: false, error: err?.message || String(err) };
    }
}
async function query(text, params) {
    const start = Date.now();
    try {
        const result = await exports.pool.query(text, params);
        const ms = Date.now() - start;
        if (process.env.DB_LOG === "true" || ms > 1000) {
            console.log(`[db] query ${ms}ms: ${text.slice(0, 120)}`);
        }
        return result;
    }
    catch (err) {
        console.error(`[db] query failed: ${err.message} | ${text.slice(0, 120)}`);
        throw err;
    }
}
async function withTransaction(fn) {
    const client = await exports.pool.connect();
    try {
        await client.query("BEGIN");
        const result = await fn(client);
        await client.query("COMMIT");
        return result;
    }
    catch (err) {
        try {
            await client.query("ROLLBACK");
        }
        catch (_) { }
        throw err;
    }
    finally {
        client.release();
    }
}
async function closePool() {
    await exports.pool.end();
    console.log("[db] pool closed");
}
//# sourceMappingURL=database.js.map