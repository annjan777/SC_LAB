import { PoolClient } from 'pg';
export declare const pool: import("pg").Pool;
export declare function query(text: string, params?: any[]): Promise<import("pg").QueryResult<any>>;
export declare function transaction<T>(callback: (client: PoolClient) => Promise<T>): Promise<T>;
