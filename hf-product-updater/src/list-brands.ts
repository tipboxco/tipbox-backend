import { query, createView, closeDb } from './db';

async function main() {
  await createView();

  const filter = process.argv[2] || '';
  const limit = parseInt(process.argv[3] || '100', 10);

  let sql = `
    SELECT store as brand, COUNT(*) as product_count
    FROM products
    WHERE store IS NOT NULL AND store != ''
  `;
  if (filter) {
    sql += ` AND LOWER(store) LIKE '%${filter.toLowerCase()}%'`;
  }
  sql += ` GROUP BY store ORDER BY product_count DESC LIMIT ${limit}`;

  const brands = await query<{ brand: string; product_count: number }>(sql);

  console.log(`=== Brands ${filter ? `matching "${filter}" ` : ''}===\n`);
  brands.forEach((b, i) => {
    console.log(`  ${i + 1}. ${b.brand} (${b.product_count} products)`);
  });
  console.log(`\nShowing ${brands.length} brands`);

  closeDb();
}

main().catch(console.error);
