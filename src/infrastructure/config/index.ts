import dotenv from 'dotenv';
import path from 'path';

// Ortama göre ilgili .env dosyasını yükle
const envFile = `.env${process.env.NODE_ENV ? `.${process.env.NODE_ENV}` : ''}`;
dotenv.config({ path: path.resolve(process.cwd(), envFile) });

type Config = {
  databaseUrl: string;
  port: number;
  nodeEnv: string;
  corsOrigins: (string | RegExp)[];
  corsMethods: string[];
  logLevel: string;
  logRetentionDays: number;
};

// Ortam bazlı default değerler
function getDefaultCorsOrigins(env: string): (string | RegExp)[] {
  switch (env) {
    case 'development':
      // Development'ta React Native ve Android Studio için esnek CORS
      // Sürekli değişen local IP adresleri için otomatik izin
      // Reference: https://socket.io/how-to/use-with-react-native
      return [
        'http://localhost:3000',
        'http://localhost:3001',
        'http://localhost:5173',
        // Android Emulator için özel IP
        'http://10.0.2.2:3000',
        // Local network IP'leri için wildcard pattern (regex ile kontrol edilecek)
        // 10.x.x.x, 192.168.x.x, 172.16-31.x.x, 100.x.x.x
        /^http:\/\/(192\.168\.|10\.|172\.(1[6-9]|2[0-9]|3[0-1])\.|100\.|10\.0\.2\.2)/,
        // HTTPS local network (self-signed certificate için)
        /^https:\/\/(192\.168\.|10\.|172\.(1[6-9]|2[0-9]|3[0-1])\.|100\.|10\.0\.2\.2)/,
      ] as any; // TypeScript için any cast (cors kütüphanesi regex'i destekler)
    case 'test':
      return [
        'http://localhost:3000',
        'https://api-test.tipbox.co',
        'http://api-test.tipbox.co',
        // Android Emulator için özel IP
        'http://10.0.2.2:3000',
        // Local network IP'leri için wildcard pattern (regex ile kontrol edilecek)
        // React Native ve Android Studio için sürekli değişen IP'leri kabul et
        /^http:\/\/(192\.168\.|10\.|172\.(1[6-9]|2[0-9]|3[0-1])\.|100\.|10\.0\.2\.2)/,
        // HTTPS local network (self-signed certificate için)
        /^https:\/\/(192\.168\.|10\.|172\.(1[6-9]|2[0-9]|3[0-1])\.|100\.|10\.0\.2\.2)/,
      ] as any;
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
  
  const nodeEnv = process.env.NODE_ENV || 'development';
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