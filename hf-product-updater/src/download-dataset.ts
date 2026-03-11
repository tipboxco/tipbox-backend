import fs from 'fs';
import path from 'path';
import { config } from './config';

const DATASET_ID = config.datasetId;

async function getParquetUrls(): Promise<string[]> {
  const url = `https://huggingface.co/api/datasets/${DATASET_ID}/parquet/default/train`;

  const headers: Record<string, string> = {};
  if (config.hfToken) {
    headers['Authorization'] = `Bearer ${config.hfToken}`;
  }

  console.log('Fetching parquet file URLs...');
  const response = await fetch(url, { headers });

  if (!response.ok) {
    throw new Error(`HF API error: ${response.status} ${response.statusText}`);
  }

  return (await response.json()) as string[];
}

async function downloadFile(url: string, dest: string): Promise<void> {
  const headers: Record<string, string> = {};
  if (config.hfToken) {
    headers['Authorization'] = `Bearer ${config.hfToken}`;
  }

  const response = await fetch(url, { headers });
  if (!response.ok) {
    throw new Error(`Download failed: ${response.status} ${response.statusText}`);
  }

  const contentLength = response.headers.get('content-length');
  const totalBytes = contentLength ? parseInt(contentLength, 10) : 0;

  const reader = response.body?.getReader();
  if (!reader) throw new Error('No response body');

  const chunks: Uint8Array[] = [];
  let downloadedBytes = 0;
  let lastLogPercent = -1;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    chunks.push(value);
    downloadedBytes += value.length;

    if (totalBytes > 0) {
      const percent = Math.floor((downloadedBytes / totalBytes) * 100);
      if (percent % 5 === 0 && percent !== lastLogPercent) {
        lastLogPercent = percent;
        const mbDownloaded = (downloadedBytes / 1024 / 1024).toFixed(1);
        const mbTotal = (totalBytes / 1024 / 1024).toFixed(1);
        process.stdout.write(`\r  Progress: ${percent}% (${mbDownloaded}/${mbTotal} MB)`);
      }
    }
  }

  console.log('');

  const buffer = Buffer.concat(chunks);
  fs.writeFileSync(dest, buffer);
}

async function main() {
  console.log('=== Hugging Face Dataset Downloader ===\n');
  console.log(`Dataset: ${DATASET_ID}\n`);

  const urls = await getParquetUrls();
  console.log(`Found ${urls.length} parquet file(s)\n`);

  fs.mkdirSync(config.dataDir, { recursive: true });

  for (let i = 0; i < urls.length; i++) {
    const fileName = `train_${String(i).padStart(4, '0')}.parquet`;
    const filePath = path.join(config.dataDir, fileName);

    if (fs.existsSync(filePath)) {
      const stat = fs.statSync(filePath);
      console.log(`[${i + 1}/${urls.length}] ${fileName} already exists (${(stat.size / 1024 / 1024).toFixed(1)} MB), skipping...`);
      continue;
    }

    console.log(`[${i + 1}/${urls.length}] Downloading ${fileName}...`);
    await downloadFile(urls[i], filePath);

    const stat = fs.statSync(filePath);
    console.log(`  Saved: ${(stat.size / 1024 / 1024).toFixed(1)} MB`);
  }

  // List downloaded files
  const files = fs.readdirSync(config.dataDir).filter((f) => f.endsWith('.parquet'));
  const totalSize = files.reduce((sum, f) => {
    return sum + fs.statSync(path.join(config.dataDir, f)).size;
  }, 0);

  console.log(`\n=== Download Complete ===`);
  console.log(`Files: ${files.length}`);
  console.log(`Total size: ${(totalSize / 1024 / 1024).toFixed(1)} MB`);
  console.log(`Location: ${config.dataDir}`);
  console.log(`\nNext: npm run list-brands`);
}

main().catch(console.error);
