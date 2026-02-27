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

/**
 * Thirdweb webhook isteklerinin geldiği host'lar (Dashboard test vb.).
 * CORS preflight / tarayıcıdan test için bu origin'lere izin verilir.
 */
const THIRDWEB_WEBHOOK_CORS_ORIGINS: string[] = [
  'https://thirdweb.com',
  'https://portal.thirdweb.com',
  'https://engine.thirdweb.com',
  '18.246.42.226'
];

/** Developer Console / API base URL – CORS_ORIGINS set edilse bile her zaman whitelist’e eklenir. */
const TIPBOX_API_CORS_ORIGINS: string[] = [
  'https://api-tipbox.tipbox.co',
  'http://api-tipbox.tipbox.co',
];

// Ortam bazlı default değerler
function getDefaultCorsOrigins(env: string): (string | RegExp)[] {
  const origins: (string | RegExp)[] = [];
  
  // BASE_URL'den origin ekle (eğer set edilmişse)
  if (process.env.BASE_URL) {
    try {
      let baseUrl = process.env.BASE_URL.replace(/\/$/, '');
      // Eğer protocol yoksa http:// ekle
      if (!baseUrl.match(/^https?:\/\//)) {
        baseUrl = `http://${baseUrl}`;
      }
      const url = new URL(baseUrl);
      const baseOrigin = `${url.protocol}//${url.host}`;
      origins.push(baseOrigin);
    } catch (error) {
      // BASE_URL parse edilemezse devam et
    }
  }

  switch (env) {
    case 'development':
      // Development'ta React Native ve Android Studio için esnek CORS
      // Sürekli değişen local IP adresleri için otomatik izin
      // Reference: https://socket.io/how-to/use-with-react-native
      // NOT: cors.config.ts'de development modunda tüm origin'lere izin veriliyor
      // Bu pattern'ler sadece CORS_ORIGINS env variable set edilmişse kullanılır
      return [
        ...origins,
        'https://api-tipbox.tipbox.co',
        'http://localhost:3000',
        'http://localhost:3001',
        'http://localhost:5173',
        // Android Emulator için özel IP
        'http://10.0.2.2:3000',
        // Local network IP'leri için wildcard pattern (regex ile kontrol edilecek)
        // 10.x.x.x, 192.168.x.x, 172.16-31.x.x, 100.x.x.x
        // Port numarası dahil: http://192.168.1.100:3000, http://10.0.0.5:5173 vb.
        /^http:\/\/(192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2[0-9]|3[0-1])\.\d+\.\d+|100\.\d+\.\d+\.\d+|10\.0\.2\.2)(:\d+)?$/,
        // HTTPS local network (self-signed certificate için)
        /^https:\/\/(192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2[0-9]|3[0-1])\.\d+\.\d+|100\.\d+\.\d+\.\d+|10\.0\.2\.2)(:\d+)?$/,
        // Herhangi bir localhost (tüm portlar)
        /^http:\/\/localhost(:\d+)?$/,
        /^https:\/\/localhost(:\d+)?$/,
      ] as any; // TypeScript için any cast (cors kütüphanesi regex'i destekler)
    case 'test':
      return [
        ...origins,
        'https://api-tipbox.tipbox.co',
        'http://localhost:3000',
        'https://api-test.tipbox.co',
        'http://api-test.tipbox.co',
        // Android Emulator için özel IP
        'http://10.0.2.2:3000',
        // Local network IP'leri için wildcard pattern (regex ile kontrol edilecek)
        // React Native ve Android Studio için sürekli değişen IP'leri kabul et
        /^http:\/\/(192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2[0-9]|3[0-1])\.\d+\.\d+|100\.\d+\.\d+\.\d+|10\.0\.2\.2)(:\d+)?$/,
        // HTTPS local network (self-signed certificate için)
        /^https:\/\/(192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2[0-9]|3[0-1])\.\d+\.\d+|100\.\d+\.\d+\.\d+|10\.0\.2\.2)(:\d+)?$/,
      ] as any;
    case 'production':
      return ['https://api-tipbox.tipbox.co', 'https://api.tipbox.co', 'https://api.tipbox.co/v1', 'https://api.tipbox.co/v1/docs', 'https://app.tipbox.co'];
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

  const baseCorsOrigins = process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(',').map((origin) => origin.trim())
    : getDefaultCorsOrigins(nodeEnv);

  // Thirdweb webhook + Tipbox API (Developer Console) origin'leri; CORS_ORIGINS set edilse bile eklenir
  const existingSet = new Set(baseCorsOrigins.map((o) => (typeof o === 'string' ? o : o.toString())));
  const corsOrigins: (string | RegExp)[] = [...baseCorsOrigins];
  for (const origin of [...THIRDWEB_WEBHOOK_CORS_ORIGINS, ...TIPBOX_API_CORS_ORIGINS]) {
    if (!existingSet.has(origin)) {
      corsOrigins.push(origin);
      existingSet.add(origin);
    }
  }

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