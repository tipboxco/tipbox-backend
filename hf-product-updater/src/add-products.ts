import { parseCsvFile } from './csv-parser';
import { query, run, createView, closeDb, getParquetGlob } from './db';
import { config } from './config';
import fs from 'fs';
import path from 'path';

async function main() {
  const csvFile = process.argv[2];
  const brand = process.argv[3];

  if (!csvFile) {
    console.log('Usage: npm run add-products -- <csv-file> [brand-name]');
    console.log('Example: npm run add-products -- csv/products_with_images.csv "Nike"');
    process.exit(1);
  }

  const csvPath = path.resolve(csvFile);
  if (!fs.existsSync(csvPath)) {
    console.error(`CSV file not found: ${csvPath}`);
    process.exit(1);
  }

  console.log('=== Product Importer ===\n');

  // Load existing dataset into DuckDB
  await createView();

  const [before] = await query<{ cnt: number }>('SELECT COUNT(*) as cnt FROM products');
  console.log(`Existing products in dataset: ${before.cnt}`);

  // Parse CSV
  const newProducts = parseCsvFile(csvPath);
  console.log(`Parsed ${newProducts.length} products from CSV`);

  if (brand) {
    newProducts.forEach((p) => (p.store = brand));
    console.log(`All products tagged with brand: "${brand}"`);
  }

  // Create a temp table from the CSV, then export combined parquet
  await run(`
    CREATE TABLE new_products (
      parent_asin VARCHAR,
      title VARCHAR,
      description VARCHAR,
      main_category VARCHAR,
      categories VARCHAR[],
      store VARCHAR,
      average_rating DOUBLE,
      rating_number DOUBLE,
      price DOUBLE,
      features VARCHAR[],
      details VARCHAR,
      image VARCHAR,
      date_first_available VARCHAR,
      filename VARCHAR
    )
  `);

  // Insert new products
  for (const p of newProducts) {
    const cats = JSON.stringify(p.categories || []);
    const feats = JSON.stringify(p.features || []);
    const details = JSON.stringify(p.details || {});

    await run(`
      INSERT INTO new_products VALUES (
        '${escape(p.parent_asin)}',
        '${escape(p.title)}',
        '${escape(p.description)}',
        '${escape(p.main_category)}',
        ${cats.replace(/"/g, "'")},
        '${escape(p.store)}',
        ${p.average_rating ?? 'NULL'},
        ${p.rating_number ?? 'NULL'},
        ${p.price ?? 'NULL'},
        ${feats.replace(/"/g, "'")},
        '${escape(details)}',
        '${escape(p.image)}',
        '${escape(p.date_first_available)}',
        '${escape(p.filename)}'
      )
    `);
  }

  const [newCount] = await query<{ cnt: number }>('SELECT COUNT(*) as cnt FROM new_products');
  console.log(`Inserted ${newCount.cnt} new products`);

  // Export combined dataset
  const outputPath = path.join(config.dataDir, 'dataset_updated.parquet').replace(/\\/g, '/');

  const glob = getParquetGlob();
  await run(`
    COPY (
      SELECT * FROM read_parquet('${glob}')
      UNION ALL
      SELECT
        parent_asin, title, description, main_category, categories, store,
        average_rating, rating_number, price, features, details,
        NULL as embeddings, image, date_first_available, filename
      FROM new_products
    ) TO '${outputPath}' (FORMAT PARQUET, COMPRESSION ZSTD)
  `);

  // Verify
  const [after] = await query<{ cnt: number }>(
    `SELECT COUNT(*) as cnt FROM read_parquet('${outputPath}')`,
  );

  console.log(`\n=== Done ===`);
  console.log(`Before: ${before.cnt} products`);
  console.log(`Added: ${newCount.cnt} products`);
  console.log(`After: ${after.cnt} products`);
  console.log(`Output: ${outputPath}`);

  closeDb();
}

function escape(str: string): string {
  return (str || '').replace(/'/g, "''");
}

main().catch(console.error);
