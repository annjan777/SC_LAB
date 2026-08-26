import { PoolClient } from 'pg';
export declare let pool: import("pg").Pool;
export declare function closePoolForRestore(): Promise<void>;
export declare function reopenPool(): void;
export declare function query(text: string, params?: any[]): Promise<import("pg").QueryResult<any>>;
export declare function transaction<T>(callback: (client: PoolClient) => Promise<T>): Promise<T>;
