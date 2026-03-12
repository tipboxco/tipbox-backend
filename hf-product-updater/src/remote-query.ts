import duckdb from 'duckdb';
import { config } from './config';

const PARQUET_BASE = `https://huggingface.co/api/datasets/${config.datasetId}/parquet/default/train`;
const PARQUET_COUNT = 4;

let dbInstance: duckdb.Database | null = null;
let connInstance: duckdb.Connection | null = null;
let initialized = false;

function runSql(conn: duckdb.Connection, sql: string): Promise<void> {
  return new Promise((resolve, reject) => {
    conn.run(sql, (err: Error | null) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

async function getConn(): Promise<duckdb.Connection> {
  if (connInstance && initialized) {
    return connInstance;
  }

  dbInstance = new duckdb.Database(':memory:');
  connInstance = dbInstance.connect();

  // Load httpfs for remote parquet access
  await runSql(connInstance, 'INSTALL httpfs; LOAD httpfs;');

  // Create HuggingFace secret for authentication (avoids 429 rate limits)
  const token = config.hfToken;
  if (token) {
    await runSql(connInstance, `CREATE SECRET hf_secret (TYPE HUGGINGFACE, TOKEN '${token}');`);
  }

  // Create a view that unions all parquet files
  const urls = Array.from({ length: PARQUET_COUNT }, (_, i) => `'${PARQUET_BASE}/${i}.parquet'`);
  await runSql(connInstance, `CREATE VIEW products AS SELECT * FROM read_parquet([${urls.join(', ')}])`);

  initialized = true;
  return connInstance;
}

async function remoteQuery<T = Record<string, unknown>>(sql: string): Promise<T[]> {
  const conn = await getConn();
  return new Promise((resolve, reject) => {
    conn.all(sql, (err: Error | null, rows: duckdb.TableData) => {
      if (err) reject(err);
      else resolve((rows ?? []) as T[]);
    });
  });
}

async function main() {
  const cmd = process.argv[2] || 'help';

  console.log('Connecting to HuggingFace...\n');

  switch (cmd) {
    case 'stats': {
      const [total] = await remoteQuery<{ cnt: number }>('SELECT COUNT(*) as cnt FROM products');
      const [brandCount] = await remoteQuery<{ cnt: number }>(
        "SELECT COUNT(DISTINCT store) as cnt FROM products WHERE store IS NOT NULL AND store != ''",
      );

      console.log('=== Remote Dataset Stats ===');
      console.log(`Total products: ${total.cnt}`);
      console.log(`Total brands: ${brandCount.cnt}`);
      break;
    }

    case 'search': {
      const keyword = process.argv[3];
      if (!keyword) {
        console.log('Usage: npm run remote -- search "Nike"');
        break;
      }
      const limit = parseInt(process.argv[4] || '20', 10);
      const kw = keyword.toLowerCase().replace(/'/g, "''");

      console.log(`Searching for "${keyword}"...\n`);
      const rows = await remoteQuery<{
        parent_asin: string;
        store: string;
        title: string;
        price: number | null;
        average_rating: number | null;
        main_category: string;
      }>(`
        SELECT parent_asin, store, title, price, average_rating, main_category
        FROM products
        WHERE LOWER(title) LIKE '%${kw}%'
           OR LOWER(store) LIKE '%${kw}%'
           OR LOWER(description) LIKE '%${kw}%'
        LIMIT ${limit}
      `);

      rows.forEach((r, i) => {
        console.log(`${i + 1}. [${r.store}] ${(r.title || '').substring(0, 80)}`);
        console.log(`   Price: $${r.price ?? 'N/A'} | Rating: ${r.average_rating ?? 'N/A'} | Category: ${r.main_category || 'N/A'}`);
      });
      console.log(`\nFound ${rows.length} results`);
      break;
    }

    case 'brand': {
      const brand = process.argv[3];
      if (!brand) {
        console.log('Usage: npm run remote -- brand "Nike"');
        break;
      }
      const limit = parseInt(process.argv[4] || '50', 10);
      const brandLower = brand.toLowerCase().replace(/'/g, "''");

      console.log(`Fetching products for brand "${brand}"...\n`);
      const rows = await remoteQuery<{
        parent_asin: string;
        title: string;
        price: number | null;
        average_rating: number | null;
        rating_number: number | null;
        main_category: string;
        image: string;
      }>(`
        SELECT parent_asin, title, price, average_rating, rating_number, main_category, image
        FROM products
        WHERE LOWER(store) = '${brandLower}'
        ORDER BY rating_number DESC NULLS LAST
        LIMIT ${limit}
      `);

      rows.forEach((r, i) => {
        console.log(`${i + 1}. [${r.parent_asin}] ${(r.title || '').substring(0, 80)}`);
        console.log(`   $${r.price ?? 'N/A'} | ${r.average_rating ?? '-'}★ (${r.rating_number ?? 0} reviews) | ${r.main_category || 'N/A'}`);
      });
      console.log(`\nShowing ${rows.length} products for "${brand}"`);
      break;
    }

    case 'brands': {
      const filter = process.argv[3] || '';
      const limit = parseInt(process.argv[4] || '30', 10);
      const filterLower = filter.toLowerCase().replace(/'/g, "''");

      let sql = "SELECT store as brand, COUNT(*) as product_count FROM products WHERE store IS NOT NULL AND store != ''";
      if (filter) {
        sql += ` AND LOWER(store) LIKE '%${filterLower}%'`;
      }
      sql += ` GROUP BY store ORDER BY product_count DESC LIMIT ${limit}`;

      const brands = await remoteQuery<{ brand: string; product_count: number }>(sql);

      console.log(`=== Brands ${filter ? `matching "${filter}" ` : ''}===\n`);
      brands.forEach((b, i) => {
        console.log(`  ${i + 1}. ${b.brand} (${b.product_count} products)`);
      });
      console.log(`\nShowing ${brands.length} brands`);
      break;
    }

    case 'export': {
      const brand = process.argv[3];
      const outputFile = process.argv[4] || 'brand_export.json';
      if (!brand) {
        console.log('Usage: npm run remote -- export "Nike" output.json');
        break;
      }
      const brandLower = brand.toLowerCase().replace(/'/g, "''");

      console.log(`Exporting all products for brand "${brand}"...\n`);

      const rows = await remoteQuery(`
        SELECT parent_asin, title, description, main_category, categories, store,
               average_rating, rating_number, price, features, details, image,
               date_first_available, filename
        FROM products
        WHERE LOWER(store) = '${brandLower}'
      `);

      const fs = await import('fs');
      const path = await import('path');
      const outPath = path.resolve(outputFile);
      fs.writeFileSync(outPath, JSON.stringify(rows, null, 2));
      console.log(`Exported ${rows.length} products to: ${outPath}`);
      break;
    }

    case 'download': {
      const format = (process.argv[3] || 'csv').toLowerCase();
      if (format !== 'csv' && format !== 'json') {
        console.log('Usage: npm run remote -- download csv|json');
        break;
      }

      const fs = await import('fs');
      const path = await import('path');
      const dataDir = path.resolve(__dirname, '..', 'data');
      if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

      const outPath = path.join(dataDir, `amazon_products.${format}`);
      console.log(`Downloading entire dataset as ${format.toUpperCase()}...`);
      console.log(`Output: ${outPath}\n`);

      const startTime = Date.now();

      if (format === 'csv') {
        await runSql(
          await getConn(),
          `COPY (
            SELECT parent_asin, title, description, main_category, categories, store,
                   average_rating, rating_number, price, features, details, image,
                   date_first_available, filename
            FROM products
          ) TO '${outPath.replace(/\\/g, '/')}' (HEADER, DELIMITER ',')`,
        );
      } else {
        await runSql(
          await getConn(),
          `COPY (
            SELECT parent_asin, title, description, main_category, categories, store,
                   average_rating, rating_number, price, features, details, image,
                   date_first_available, filename
            FROM products
          ) TO '${outPath.replace(/\\/g, '/')}' (FORMAT JSON, ARRAY true)`,
        );
      }

      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      const stats = fs.statSync(outPath);
      const sizeMB = (stats.size / (1024 * 1024)).toFixed(1);
      console.log(`Done! ${sizeMB}MB downloaded in ${elapsed}s`);
      break;
    }

    case 'sql': {
      const sql = process.argv[3];
      if (!sql) {
        console.log('Usage: npm run remote -- sql "SELECT * FROM products LIMIT 5"');
        break;
      }
      const rows = await remoteQuery(sql);
      console.log(JSON.stringify(rows, null, 2));
      break;
    }

    default:
      console.log(`
=== Remote Query (no download needed) ===

  npm run remote -- stats                       Dataset stats
  npm run remote -- search "keyword" [limit]    Full-text search
  npm run remote -- brand "Nike" [limit]        All products by brand
  npm run remote -- brands [filter] [limit]     List brands
  npm run remote -- export "Nike" out.json      Export brand data to JSON
  npm run remote -- download csv|json           Download entire dataset
  npm run remote -- sql "SELECT ..."            Custom SQL (table: products)
      `);
  }

  if (dbInstance) dbInstance.close();
}

main().catch(console.error);
