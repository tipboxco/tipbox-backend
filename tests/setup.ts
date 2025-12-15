import dotenv from 'dotenv';
dotenv.config({ path: '.env.test' });

// Test ortamında DATABASE_URL'i localhost olarak ayarla
// (Testler container dışında çalıştığı için 'postgres' hostname'ine erişemez)
if (process.env.DATABASE_URL && process.env.DATABASE_URL.includes('postgres:5432')) {
  process.env.DATABASE_URL = process.env.DATABASE_URL.replace('postgres:5432', 'localhost:5432');
} else if (!process.env.DATABASE_URL) {
  // Eğer DATABASE_URL yoksa varsayılan olarak localhost kullan
  process.env.DATABASE_URL = 'postgresql://postgres:postgres@localhost:5432/tipbox_dev';
}

// Optionally, you can prepare DB here by calling prisma migrate/db push.
// Keeping minimal to avoid side effects; rely on developer to prep DB before tests.



