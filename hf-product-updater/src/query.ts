import { query, createView, closeDb } from './db';

async function main() {
  const cmd = process.argv[2] || 'stats';

  await createView();

  switch (cmd) {
    case 'stats': {
      const [total] = await query<{ cnt: number }>('SELECT COUNT(*) as cnt FROM products');
      const [brandCount] = await query<{ cnt: number }>(
        'SELECT COUNT(DISTINCT store) as cnt FROM products WHERE store IS NOT NULL AND store != \'\'',
      );
      const [catCount] = await query<{ cnt: number }>(
        'SELECT COUNT(DISTINCT main_category) as cnt FROM products WHERE main_category IS NOT NULL AND main_category != \'\'',
      );

      console.log('=== Dataset Stats ===');
      console.log(`Total products: ${total.cnt}`);
      console.log(`Total brands (store): ${brandCount.cnt}`);
      console.log(`Total categories: ${catCount.cnt}`);
      break;
    }

    case 'brands': {
      const filter = process.argv[3] || '';
      const limit = parseInt(process.argv[4] || '50', 10);

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
      console.log(`=== Brands ${filter ? `matching "${filter}" ` : ''}(top ${limit}) ===\n`);
      brands.forEach((b, i) => {
        console.log(`  ${i + 1}. ${b.brand} (${b.product_count} products)`);
      });
      console.log(`\nShowing ${brands.length} brands`);
      break;
    }

    case 'categories': {
      const cats = await query<{ category: string; cnt: number }>(`
        SELECT main_category as category, COUNT(*) as cnt
        FROM products
        WHERE main_category IS NOT NULL AND main_category != ''
        GROUP BY main_category
        ORDER BY cnt DESC
      `);
      console.log('=== Categories ===\n');
      cats.forEach((c, i) => {
        console.log(`  ${i + 1}. ${c.category} (${c.cnt} products)`);
      });
      break;
    }

    case 'search': {
      const keyword = process.argv[3];
      if (!keyword) {
        console.log('Usage: npm run query -- search "keyword" [limit]');
        break;
      }
      const limit = parseInt(process.argv[4] || '20', 10);
      const kw = keyword.toLowerCase().replace(/'/g, "''");

      const results = await query<{
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

      console.log(`=== Search: "${keyword}" ===\n`);
      results.forEach((r, i) => {
        const price = r.price ? `$${r.price}` : 'N/A';
        const rating = r.average_rating ? `${r.average_rating}★` : 'N/A';
        console.log(`  ${i + 1}. [${r.store || 'N/A'}] ${(r.title || '').substring(0, 80)}`);
        console.log(`     Price: ${price} | Rating: ${rating} | Category: ${r.main_category || 'N/A'}`);
      });
      console.log(`\nFound ${results.length} results`);
      break;
    }

    case 'brand-products': {
      const brand = process.argv[3];
      if (!brand) {
        console.log('Usage: npm run query -- brand-products "BrandName"');
        break;
      }
      const products = await query<{
        parent_asin: string;
        title: string;
        price: number | null;
        average_rating: number | null;
        main_category: string;
      }>(`
        SELECT parent_asin, title, price, average_rating, main_category
        FROM products
        WHERE LOWER(store) = '${brand.toLowerCase()}'
        ORDER BY rating_number DESC NULLS LAST
        LIMIT 50
      `);
      console.log(`=== Products by "${brand}" (top 50) ===\n`);
      products.forEach((p, i) => {
        const price = p.price ? `$${p.price}` : 'N/A';
        const rating = p.average_rating ? `${p.average_rating}★` : 'N/A';
        console.log(`  ${i + 1}. [${p.parent_asin}] ${p.title}`);
        console.log(`     Price: ${price} | Rating: ${rating} | Category: ${p.main_category || 'N/A'}`);
      });
      console.log(`\nTotal: ${products.length} products`);
      break;
    }

    case 'sql': {
      const sql = process.argv[3];
      if (!sql) {
        console.log('Usage: npm run query -- sql "SELECT * FROM products LIMIT 10"');
        break;
      }
      const rows = await query(sql);
      console.log(JSON.stringify(rows, null, 2));
      break;
    }

    default:
      console.log(`
=== Query Commands ===

  npm run query                             Dataset stats
  npm run query -- search "keyword" [limit] Search products
  npm run query -- brands [filter] [limit]  List brands
  npm run query -- categories               List categories
  npm run query -- brand-products "Nike"    Products by brand
  npm run query -- sql "SELECT ..."         Custom SQL query
      `);
  }

  closeDb();
}

main().catch(console.error);
