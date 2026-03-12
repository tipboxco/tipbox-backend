import duckdb from 'duckdb';
import path from 'path';
import fs from 'fs';
import { config } from './config';

let dbInstance: duckdb.Database | null = null;
let connInstance: duckdb.Connection | null = null;

export function getDataSource(): { type: 'csv' | 'parquet'; path: string } {
  const csvPath = path.join(config.dataDir, 'amazon_products.csv');
  if (fs.existsSync(csvPath)) {
    return { type: 'csv', path: csvPath.replace(/\\/g, '/') };
  }

  const parquetFiles = fs.readdirSync(config.dataDir).filter((f) => f.endsWith('.parquet'));
  if (parquetFiles.length > 0) {
    return { type: 'parquet', path: path.join(config.dataDir, '*.parquet').replace(/\\/g, '/') };
  }

  throw new Error('No data files found. Run "npm run remote -- download csv" first.');
}

export function getDb(): { db: duckdb.Database; conn: duckdb.Connection } {
  if (!dbInstance) {
    dbInstance = new duckdb.Database(':memory:');
    connInstance = dbInstance.connect();
  }
  return { db: dbInstance, conn: connInstance! };
}

export function query<T = Record<string, unknown>>(sql: string): Promise<T[]> {
  const { conn } = getDb();
  return new Promise((resolve, reject) => {
    conn.all(sql, (err: Error | null, rows: T[]) => {
      if (err) reject(err);
      else resolve(rows ?? []);
    });
  });
}

export function run(sql: string): Promise<void> {
  const { conn } = getDb();
  return new Promise((resolve, reject) => {
    conn.run(sql, (err: Error | null) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

export async function createView(): Promise<void> {
  const source = getDataSource();
  if (source.type === 'csv') {
    await run(`CREATE OR REPLACE VIEW products AS SELECT * FROM read_csv('${source.path}', auto_detect=true)`);
  } else {
    await run(`CREATE OR REPLACE VIEW products AS SELECT * FROM read_parquet('${source.path}')`);
  }
}

export function closeDb(): void {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
    connInstance = null;
  }
}
