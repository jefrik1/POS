import { Pool, QueryResult, QueryResultRow } from "pg";
export declare const pool: Pool;
export declare function checkConnection(): Promise<{
    ok: boolean;
    latencyMs?: number;
    error?: string;
}>;
export declare function query<T extends QueryResultRow = any>(text: string, params?: any[]): Promise<QueryResult<T>>;
export declare function withTransaction<T>(fn: (client: import("pg").PoolClient) => Promise<T>): Promise<T>;
export declare function closePool(): Promise<void>;
//# sourceMappingURL=database.d.ts.map