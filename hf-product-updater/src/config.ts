import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

export const config = {
  hfToken: process.env.HF_TOKEN || '',
  datasetId: process.env.HF_DATASET_ID || 'milistu/AMAZON-Products-2023',
  dataDir: path.resolve(__dirname, '../data'),
  csvDir: path.resolve(__dirname, '../csv'),
};
