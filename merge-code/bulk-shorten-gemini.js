/**
 * Bulk shorten script: Gemini API ile product_with_images2.csv içindeki
 * boş shorten_title alanlarını "Clean and shorten the following e-commerce product title"
 * promptu ile doldurur. Belirli batch aralıklarıyla istek atar.
 *
 * Gereksinim: GEMINI_API_KEY environment variable veya .env
 * Kullanım: node scripts/bulk-shorten-gemini.js
 *   BATCH_SIZE=10 DELAY_MS=2000 node scripts/bulk-shorten-gemini.js
 */

const fs = require('fs');
const path = require('path');
const Papa = require('papaparse');

try {
  require('dotenv').config({ path: path.join(__dirname, '.env') });
} catch {
  // dotenv optional
}

const DIR = path.join(__dirname);
const INPUT_CSV = path.join(DIR, 'product_with_images2.csv');
const OUTPUT_CSV = path.join(DIR, 'product_with_images2.csv');

const SHORTEN_PROMPT =
  'Clean and shorten the following e-commerce product title. Return only the shortened title, nothing else. No quotes, no numbering.';
const BATCH_SIZE = parseInt(process.env.BATCH_SIZE || '10', 10);
const DELAY_MS = parseInt(process.env.DELAY_MS || '2000', 10);
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.0-flash';

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function shortenWithGemini(ai, title) {
  const prompt = `${SHORTEN_PROMPT}\n\n${title}`;
  const response = await ai.models.generateContent({
    model: GEMINI_MODEL,
    contents: prompt,
  });
  const text = response?.text;
  if (text == null) return '';
  return String(text).trim();
}

async function processBatch(ai, batch) {
  const results = await Promise.allSettled(
    batch.map((item) => shortenWithGemini(ai, item.title))
  );
  return results.map((r, i) => {
    if (r.status === 'fulfilled') return { rowIndex: batch[i].rowIndex, value: r.value };
    console.warn(`Gemini failed for id ${batch[i].id}:`, r.reason?.message || r.reason);
    return { rowIndex: batch[i].rowIndex, value: '' };
  });
}

async function main() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error('GEMINI_API_KEY is required. Set it in .env or environment.');
    process.exit(1);
  }

  const GoogleGenAI = require('@google/genai').GoogleGenAI;
  const ai = new GoogleGenAI({ apiKey });

  if (!fs.existsSync(INPUT_CSV)) {
    console.error(`File not found: ${INPUT_CSV}. Run merge-products-with-shorten.js first.`);
    process.exit(1);
  }

  const raw = fs.readFileSync(INPUT_CSV, 'utf-8');
  const parsed = Papa.parse(raw, {
    header: true,
    skipEmptyLines: false,
    quoteChar: '"',
  });

  const rows = parsed.data;
  const headers = parsed.meta.fields || [];
  if (!headers.includes('shorten_title')) {
    console.error('CSV must have shorten_title column. Run merge-products-with-shorten.js first.');
    process.exit(1);
  }

  const toProcess = rows
    .map((row, rowIndex) => ({ row, rowIndex }))
    .filter(({ row }) => {
      const st = row.shorten_title != null ? String(row.shorten_title).trim() : '';
      const title = row.title != null ? String(row.title).trim() : '';
      return !st && title;
    });

  if (toProcess.length === 0) {
    console.log('No rows need shortening. Exiting.');
    return;
  }

  console.log(`Total rows: ${rows.length}. To shorten: ${toProcess.length}. Batch size: ${BATCH_SIZE}, delay: ${DELAY_MS}ms`);

  let processed = 0;
  for (let i = 0; i < toProcess.length; i += BATCH_SIZE) {
    const slice = toProcess.slice(i, i + BATCH_SIZE);
    const batch = slice.map(({ row, rowIndex }) => ({
      id: row.id,
      title: row.title,
      rowIndex,
    }));

    const results = await processBatch(ai, batch);
    for (const { rowIndex, value } of results) {
      rows[rowIndex].shorten_title = value;
    }
    processed += batch.length;
    console.log(`Batch done: ${processed}/${toProcess.length}`);

    if (i + BATCH_SIZE < toProcess.length) {
      await sleep(DELAY_MS);
    }
  }

  const csv = Papa.unparse(rows, {
    columns: headers,
    header: true,
    quoteChar: '"',
  });
  fs.writeFileSync(OUTPUT_CSV, csv, 'utf-8');
  console.log(`Updated ${path.basename(OUTPUT_CSV)} with ${processed} new shorten_title values.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
