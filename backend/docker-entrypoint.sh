#!/bin/sh
set -e

# DATABASE_URL'den host ve port'u çıkar
# Format: postgresql://user:pass@host:port/db
if [ -n "$DATABASE_URL" ]; then
  # @ sonrasını al (host:port/db)
  DB_PART="${DATABASE_URL#*@}"
  # host'i al (ilk : öncesi)
  DB_HOST="${DB_PART%%:*}"
  # port'u al (ilk : sonrası, / öncesi)
  DB_PORT="${DB_PART#*:}"
  DB_PORT="${DB_PORT%%/*}"
fi

# Eğer DATABASE_URL'den çıkarılamazsa varsayılan değerleri kullan
DB_HOST="${DB_HOST:-${POSTGRES_HOST:-postgres}}"
DB_PORT="${DB_PORT:-${POSTGRES_PORT:-5432}}"

echo "🔄 PostgreSQL'in hazır olmasını bekliyorum... (${DB_HOST}:${DB_PORT})"

# PostgreSQL'in hazır olmasını bekle (max 30 deneme, 2 saniye aralıklarla)
max_attempts=30
attempt=0

while [ $attempt -lt $max_attempts ]; do
  # netcat ile port kontrolü yap
  if nc -z "$DB_HOST" "$DB_PORT" 2>/dev/null; then
    echo "✅ PostgreSQL hazır!"
    break
  fi
  
  attempt=$((attempt + 1))
  if [ $attempt -lt $max_attempts ]; then
    echo "⏳ PostgreSQL bekleniyor... ($attempt/$max_attempts)"
    sleep 2
  fi
done

if [ $attempt -eq $max_attempts ]; then
  echo "❌ PostgreSQL'e bağlanılamadı! (${DB_HOST}:${DB_PORT})"
  exit 1
fi

# node_modules eksikse yeniden yükle
# (named volume boş olabilir veya güncellenmiş olabilir)
if [ ! -d "node_modules/.prisma" ] || [ ! -d "node_modules/@prisma/client" ]; then
  echo "🔄 node_modules eksik veya Prisma Client bulunamadı, yükleniyor..."
  pnpm install
  echo "✅ Bağımlılıklar yüklendi!"
fi

# Prisma Client'ı her zaman generate et (schema değişmiş olabilir)
echo "🔄 Prisma Client generate ediliyor..."
pnpm exec prisma generate
echo "✅ Prisma Client hazır!"

if [ "${SKIP_DB_MIGRATIONS}" = "1" ] || [ "${SKIP_DB_MIGRATIONS}" = "true" ]; then
  echo "⏭️  SKIP_DB_MIGRATIONS aktif: migration/db push atlanıyor."
else
  echo "🔄 Veritabanı migration'ları uygulanıyor..."
  # db push kullan (development için), production'da migrate deploy kullanılabilir
  if npx prisma db push --skip-generate; then
    echo "✅ Migration'lar başarıyla uygulandı!"
  else
    echo "⚠️  db push başarısız, migrate deploy deneniyor..."
    npx prisma migrate deploy || echo "⚠️  Migration hatası, devam ediliyor..."
  fi

  echo "✅ Migration işlemi tamamlandı!"
fi

# Gelen komutu çalıştır (pnpm run dev gibi)
exec "$@"

