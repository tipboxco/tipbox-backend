import dotenv from 'dotenv';
import path from 'path';

// Ortama göre ilgili .env dosyasını yükle
const envFile = `.env${process.env.NODE_ENV ? `.${process.env.NODE_ENV}` : ''}`;
dotenv.config({ path: path.resolve(process.cwd(), envFile) });

type Config = {
  databaseUrl: string;
  port: number;
  nodeEnv: string;
};

function getConfig(): Config {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL tanımlı değil!');
  if (!process.env.PORT) throw new Error('PORT tanımlı değil!');
  if (!process.env.NODE_ENV) throw new Error('NODE_ENV tanımlı değil!');
  return {
    databaseUrl: process.env.DATABASE_URL,
    port: Number(process.env.PORT),
    nodeEnv: process.env.NODE_ENV,
  };
}

const config = getConfig();
export default config; 