/**
 * Merge script: products_with_images.csv + product_some_shorted_2.csv
 * Creates product_with_images2.csv with a new column "shorten_title".
 * Rows that have id in product_some_shorted_2 get that shorten_title; others get empty.
 */

const fs = require('fs');
const path = require('path');
const Papa = require('papaparse');

const DIR = path.join(__dirname);
const PRODUCTS_CSV = path.join(DIR, 'products_with_images.csv');
const SHORTENED_CSV = path.join(DIR, 'product_some_shorted_2.csv');
const OUTPUT_CSV = path.join(DIR, 'product_with_images2.csv');

function loadShortenedMap() {
  const raw = fs.readFileSync(SHORTENED_CSV, 'utf-8');
  const parsed = Papa.parse(raw, {
    header: false,
    skipEmptyLines: true,
    quoteChar: '"',
  });
  const map = new Map();
  for (const row of parsed.data) {
    const id = row[0] != null ? String(row[0]).trim() : '';
    const shortenTitle = row.length >= 2 ? String(row[1] || '').trim() : '';
    if (id) map.set(id, shortenTitle);
  }
  return map;
}

function main() {
  const shortenedMap = loadShortenedMap();
  console.log(`Loaded ${shortenedMap.size} shortened titles from product_some_shorted_2.csv`);

  const productsRaw = fs.readFileSync(PRODUCTS_CSV, 'utf-8');
  const productsParsed = Papa.parse(productsRaw, {
    header: true,
    skipEmptyLines: false,
    quoteChar: '"',
  });

  const rows = productsParsed.data;
  const originalHeaders = productsParsed.meta.fields || [];
  const headers = [...originalHeaders, 'shorten_title'];

  const merged = rows.map((row) => {
    const id = row.id != null ? String(row.id).trim() : '';
    const shortenTitle = id ? (shortenedMap.get(id) || '') : '';
    return {
      ...row,
      shorten_title: shortenTitle,
    };
  });

  const csv = Papa.unparse(merged, {
    columns: headers,
    header: true,
    quoteChar: '"',
  });

  fs.writeFileSync(OUTPUT_CSV, csv, 'utf-8');
  console.log(`Written ${merged.length} rows to ${path.basename(OUTPUT_CSV)}`);
  const withShorten = merged.filter((r) => r.shorten_title).length;
  const withoutShorten = merged.length - withShorten;
  console.log(`  - With shorten_title: ${withShorten}`);
  console.log(`  - Without (to shorten via Gemini): ${withoutShorten}`);
}

main();
