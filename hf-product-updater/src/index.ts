async function main() {
  console.log(`
=== HF Product Updater ===

Commands:
  npm run download                                Download full dataset (parquet)
  npm run query                                   Dataset stats
  npm run query -- brands [filter] [limit]        List brands
  npm run query -- categories                     List categories
  npm run query -- brand-products "Nike"          Products by brand
  npm run query -- sql "SELECT ..."               Custom SQL query
  npm run add-products -- <csv> [brand]           Add products from CSV
  npm run list-brands [filter]                    List brands (shortcut)

Workflow:
  1. npm run download                             Download 117K products (~1.6GB)
  2. npm run query -- brands                      See top brands
  3. npm run add-products -- csv/file.csv "Nike"  Add new products by brand
  `);
}

main().catch(console.error);
