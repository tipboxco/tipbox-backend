import duckdb from 'duckdb';
import { config } from './config';

/**
 * McAuley-Lab/Amazon-Reviews-2023 remote query
 * 48M+ products across 34 categories - queried directly from HuggingFace
 */

const MCAULEY_BASE = 'https://huggingface.co/datasets/McAuley-Lab/Amazon-Reviews-2023/resolve/main';

// Categories with parquet files (fast remote query)
const PARQUET_CATEGORIES: Record<string, number> = {
  Electronics: 10,
  Cell_Phones_and_Accessories: 7,
  Toys_and_Games: 5,
  Arts_Crafts_and_Sewing: 4,
  Industrial_and_Scientific: 2,
  Musical_Instruments: 2,
  All_Beauty: 1,
  Gift_Cards: 1,
  Handmade_Products: 1,
};

// All categories (JSONL fallback for those without parquet)
const ALL_CATEGORIES = [
  'All_Beauty', 'Amazon_Fashion', 'Appliances', 'Arts_Crafts_and_Sewing',
  'Automotive', 'Baby_Products', 'Beauty_and_Personal_Care', 'Books',
  'CDs_and_Vinyl', 'Cell_Phones_and_Accessories', 'Clothing_Shoes_and_Jewelry',
  'Digital_Music', 'Electronics', 'Gift_Cards', 'Grocery_and_Gourmet_Food',
  'Handmade_Products', 'Health_and_Household', 'Health_and_Personal_Care',
  'Home_and_Kitchen', 'Industrial_and_Scientific', 'Kindle_Store',
  'Magazine_Subscriptions', 'Movies_and_TV', 'Musical_Instruments',
  'Office_Products', 'Patio_Lawn_and_Garden', 'Pet_Supplies', 'Software',
  'Sports_and_Outdoors', 'Subscription_Boxes', 'Tools_and_Home_Improvement',
  'Toys_and_Games', 'Unknown', 'Video_Games',
];

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
  if (connInstance && initialized) return connInstance;

  dbInstance = new duckdb.Database(':memory:');
  connInstance = dbInstance.connect();

  await runSql(connInstance, 'INSTALL httpfs; LOAD httpfs;');

  const token = config.hfToken;
  if (token) {
    await runSql(connInstance, `CREATE SECRET hf_secret (TYPE HUGGINGFACE, TOKEN '${token}');`);
  }

  initialized = true;
  return connInstance;
}

async function queryDb<T = Record<string, unknown>>(sql: string): Promise<T[]> {
  const conn = await getConn();
  return new Promise((resolve, reject) => {
    conn.all(sql, (err: Error | null, rows: duckdb.TableData) => {
      if (err) reject(err);
      else resolve((rows ?? []) as T[]);
    });
  });
}

function getParquetUrls(category: string): string[] {
  const count = PARQUET_CATEGORIES[category];
  if (!count) return [];
  return Array.from({ length: count }, (_, i) => {
    const padded = String(i).padStart(5, '0');
    const total = String(count).padStart(5, '0');
    return `${MCAULEY_BASE}/raw_meta_${category}/full-${padded}-of-${total}.parquet`;
  });
}

function getJsonlUrl(category: string): string {
  return `${MCAULEY_BASE}/raw/meta_categories/meta_${category}.jsonl`;
}

function getCategorySource(category: string): string {
  const parquetUrls = getParquetUrls(category);
  if (parquetUrls.length > 0) {
    const urlList = parquetUrls.map(u => `'${u}'`).join(', ');
    return `read_parquet([${urlList}])`;
  }
  return `read_json('${getJsonlUrl(category)}', format='newline_delimited', ignore_errors=true)`;
}

// Map user-friendly names to category keys
function resolveCategory(input: string): string | null {
  const lower = input.toLowerCase().replace(/[^a-z0-9]/g, '');
  const match = ALL_CATEGORIES.find(c =>
    c.toLowerCase().replace(/_/g, '').includes(lower)
  );
  return match || null;
}

async function main() {
  const cmd = process.argv[2] || 'help';

  console.log('McAuley-Lab/Amazon-Reviews-2023 (48M+ products)\n');

  switch (cmd) {
    case 'categories': {
      console.log('=== Available Categories ===\n');
      ALL_CATEGORIES.forEach((c, i) => {
        const hasParquet = PARQUET_CATEGORIES[c] ? ' (fast)' : ' (jsonl)';
        console.log(`  ${i + 1}. ${c.replace(/_/g, ' ')}${hasParquet}`);
      });
      console.log(`\nTotal: ${ALL_CATEGORIES.length} categories`);
      break;
    }

    case 'search': {
      const keyword = process.argv[3];
      const categoryInput = process.argv[4];
      if (!keyword) {
        console.log('Usage: npm run mcauley -- search "iPhone" [category]');
        console.log('Example: npm run mcauley -- search "iPhone" Electronics');
        break;
      }
      const limit = parseInt(process.argv[5] || '20', 10);
      const kw = keyword.toLowerCase().replace(/'/g, "''");

      let categories: string[] = [];
      if (categoryInput) {
        const resolved = resolveCategory(categoryInput);
        if (!resolved) {
          console.log(`Category "${categoryInput}" not found. Run: npm run mcauley -- categories`);
          break;
        }
        categories = [resolved];
      } else {
        // Search parquet categories first (faster), limit scope
        categories = Object.keys(PARQUET_CATEGORIES);
      }

      console.log(`Searching "${keyword}" in ${categories.length} categories...\n`);

      type Row = {
        parent_asin: string;
        store: string;
        title: string;
        price: number | null;
        average_rating: number | null;
        main_category: string;
      };

      const allRows: Row[] = [];
      for (const cat of categories) {
        if (allRows.length >= limit) break;
        const remaining = limit - allRows.length;
        const src = getCategorySource(cat);
        try {
          const rows = await queryDb<Row>(`
            SELECT parent_asin, store, title, price, average_rating, main_category
            FROM ${src}
            WHERE LOWER(title) LIKE '%${kw}%'
               OR LOWER(store) LIKE '%${kw}%'
            LIMIT ${remaining}
          `);
          allRows.push(...rows);
          if (rows.length > 0) {
            console.log(`  [${cat.replace(/_/g, ' ')}] ${rows.length} results`);
          }
        } catch (err) {
          console.error(`  Warning: ${cat} failed, skipping...`);
        }
      }

      console.log('');
      allRows.slice(0, limit).forEach((r, i) => {
        console.log(`${i + 1}. [${r.store || 'N/A'}] ${(r.title || '').substring(0, 80)}`);
        console.log(`   Price: $${r.price ?? 'N/A'} | Rating: ${r.average_rating ?? 'N/A'} | Category: ${r.main_category || 'N/A'}`);
      });
      console.log(`\nFound ${allRows.length} results`);
      break;
    }

    case 'brand': {
      const brand = process.argv[3];
      const categoryInput = process.argv[4];
      if (!brand) {
        console.log('Usage: npm run mcauley -- brand "Apple" [category] [limit]');
        break;
      }
      const limit = parseInt(process.argv[5] || '30', 10);
      const brandLower = brand.toLowerCase().replace(/'/g, "''");

      let categories: string[] = [];
      if (categoryInput) {
        const resolved = resolveCategory(categoryInput);
        if (!resolved) {
          console.log(`Category "${categoryInput}" not found.`);
          break;
        }
        categories = [resolved];
      } else {
        categories = Object.keys(PARQUET_CATEGORIES);
      }

      console.log(`Fetching "${brand}" products from ${categories.length} categories...\n`);

      type Row = {
        parent_asin: string;
        title: string;
        price: number | null;
        average_rating: number | null;
        rating_number: number | null;
        main_category: string;
      };

      const allRows: Row[] = [];
      for (const cat of categories) {
        const src = getCategorySource(cat);
        try {
          const rows = await queryDb<Row>(`
            SELECT parent_asin, title, price, average_rating, rating_number, main_category
            FROM ${src}
            WHERE LOWER(store) LIKE '%${brandLower}%'
            ORDER BY rating_number DESC NULLS LAST
          `);
          allRows.push(...rows);
          if (rows.length > 0) {
            console.log(`  [${cat.replace(/_/g, ' ')}] ${rows.length} products`);
          }
        } catch (err) {
          console.error(`  Warning: ${cat} failed, skipping...`);
        }
      }

      // Sort all by rating_number desc and limit
      allRows.sort((a, b) => (b.rating_number ?? 0) - (a.rating_number ?? 0));
      const limited = allRows.slice(0, limit);

      console.log('');
      limited.forEach((r, i) => {
        console.log(`${i + 1}. [${r.parent_asin}] ${(r.title || '').substring(0, 80)}`);
        console.log(`   $${r.price ?? 'N/A'} | ${r.average_rating ?? '-'}★ (${r.rating_number ?? 0} reviews) | ${r.main_category || 'N/A'}`);
      });
      console.log(`\nShowing ${limited.length}/${allRows.length} products for "${brand}"`);
      break;
    }

    case 'count': {
      const categoryInput = process.argv[3];
      if (!categoryInput) {
        console.log('Usage: npm run mcauley -- count Electronics');
        break;
      }
      const resolved = resolveCategory(categoryInput);
      if (!resolved) {
        console.log(`Category "${categoryInput}" not found.`);
        break;
      }
      const src = getCategorySource(resolved);
      console.log(`Counting products in ${resolved}...`);
      const [row] = await queryDb<{ cnt: number }>(`SELECT COUNT(*) as cnt FROM ${src}`);
      console.log(`Total: ${row.cnt} products`);
      break;
    }

    default:
      console.log(`
=== McAuley Dataset - Remote Query ===

  npm run mcauley -- categories                        List all categories
  npm run mcauley -- search "keyword" [category]       Search products
  npm run mcauley -- brand "Apple" [category] [limit]  Products by brand
  npm run mcauley -- count "Electronics"               Count products in category

Examples:
  npm run mcauley -- search "iPhone"                   Search all parquet categories
  npm run mcauley -- search "iPhone" Electronics       Search specific category
  npm run mcauley -- brand "Apple" Electronics 50      Apple products in Electronics
  npm run mcauley -- brand "Nike" all                  Nike across all categories (slow)
      `);
  }

  if (dbInstance) dbInstance.close();
}

main().catch(console.error);
