/* eslint-disable no-console */
const fs = require("fs");
const path = require("path");
const Papa = require("papaparse");

function normalizeBrandName(name) {
  return String(name ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function main() {
  const inputPath =
    process.argv[2] ||
    path.join(process.cwd(), "src", "scripts", "tipbox-datas", "brands_2.csv");

  const outputPath =
    process.argv[3] ||
    path.join(
      process.cwd(),
      "src",
      "scripts",
      "tipbox-datas",
      "brands_2.distinct.csv"
    );

  const csvContent = fs.readFileSync(inputPath, "utf8");

  const parsed = Papa.parse(csvContent, {
    header: true,
    skipEmptyLines: true,
  });

  if (parsed.errors?.length) {
    console.error("CSV parse errors:", parsed.errors.slice(0, 5));
    process.exitCode = 1;
    return;
  }

  const fields = parsed.meta?.fields || [];
  const rows = Array.isArray(parsed.data) ? parsed.data : [];

  const seen = new Set();
  const distinct = [];

  for (const row of rows) {
    const key = normalizeBrandName(row?.name);
    if (!key) continue;
    if (seen.has(key)) continue;
    seen.add(key);
    distinct.push(row);
  }

  const outputCsv = Papa.unparse(distinct, {
    columns: fields.length ? fields : undefined,
    quotes: false,
    skipEmptyLines: true,
  });

  fs.writeFileSync(outputPath, outputCsv + "\n", "utf8");

  console.log(
    `Done. Input rows: ${rows.length}, distinct rows: ${distinct.length}, removed: ${
      rows.length - distinct.length
    }`
  );
  console.log(`Wrote: ${outputPath}`);
}

main();

