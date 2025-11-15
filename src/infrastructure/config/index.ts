import dotenv from 'dotenv';
import path from 'path';

// Ortama göre ilgili .env dosyasını yükle
const nodeEnv = process.env.NODE_ENV || 'development';
const envFile = `.env${nodeEnv !== 'development' ? `.${nodeEnv}` : ''}`;
dotenv.config({ path: path.resolve(process.cwd(), envFile) });

type Config = {
  databaseUrl: string;
  port: number;
  nodeEnv: string;
  corsOrigins: string[];
  corsMethods: string[];
  logLevel: string;
  logRetentionDays: number;
};

// Ortam bazlı default değerler
function getDefaultCorsOrigins(env: string): string[] {
  switch (env) {
    case 'development':
      return ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:5173'];
    case 'test':
      return ['http://localhost:3000', 'https://test-api.tipbox.co'];
    case 'production':
      return ['https://api.tipbox.co', 'https://api.tipbox.co/v1', 'https://api.tipbox.co/v1/docs', 'https://app.tipbox.co'];
    default:
      return ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:5173'];
  }
}

function getLogLevel(env: string): string {
  switch (env) {
    case 'development':
      return 'debug';
    case 'test':
      return 'info';
    case 'production':
      return 'warn';
    default:
      return 'info';
  }
}

function getLogRetentionDays(env: string): number {
  switch (env) {
    case 'development':
      return 7;
    case 'test':
      return 30;
    case 'production':
      return 90;
    default:
      return 30;
  }
}

function getConfig(): Config {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL tanımlı değil!');
  }
  if (!process.env.PORT) {
    throw new Error('PORT tanımlı değil!');
  }
  if (!nodeEnv) {
    throw new Error('NODE_ENV tanımlı değil!');
  }

  const corsOrigins = process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(',').map((origin) => origin.trim())
    : getDefaultCorsOrigins(nodeEnv);

  const corsMethods = process.env.CORS_METHODS
    ? process.env.CORS_METHODS.split(',').map((method) => method.trim())
    : ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'];

  return {
    databaseUrl: process.env.DATABASE_URL,
    port: Number(process.env.PORT),
    nodeEnv,
    corsOrigins,
    corsMethods,
    logLevel: getLogLevel(nodeEnv),
    logRetentionDays: getLogRetentionDays(nodeEnv),
  };
}

const config = getConfig();
export default config; 