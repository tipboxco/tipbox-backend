#!/bin/sh
set -e

# DATABASE_URL'den host ve port'u çıkar
# Format: postgresql://user:pass@host:port/db
if [ -n "$DATABASE_URL" ]; then
  DB_PART="${DATABASE_URL#*@}"
  DB_HOST="${DB_PART%%:*}"
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

# ── node_modules kontrolü ──
# Build aşamasında deps /deps/node_modules'e yüklendi.
# Burada sadece volume ile karşılaştırıp gerekirse kopyalıyoruz.
LOCK_CHECKSUM=""
if [ -f "pnpm-lock.yaml" ]; then
  LOCK_CHECKSUM=$(md5sum pnpm-lock.yaml | cut -d' ' -f1)
fi
STORED_CHECKSUM=""
if [ -f "node_modules/.lock-checksum" ]; then
  STORED_CHECKSUM=$(cat node_modules/.lock-checksum)
fi

# Image'daki build-time checksum
IMAGE_CHECKSUM=""
if [ -f "/deps/node_modules/.lock-checksum" ]; then
  IMAGE_CHECKSUM=$(cat /deps/node_modules/.lock-checksum)
fi

sync_from_image() {
  echo "📦 Build cache'den node_modules senkronize ediliyor..."
  # Volume'u temizle ve build'deki deps'i kopyala
  rm -rf node_modules/.pnpm node_modules/.modules.yaml node_modules/.lock-checksum 2>/dev/null || true
  cp -a /deps/node_modules/. node_modules/
  echo "✅ Bağımlılıklar senkronize edildi (build cache)!"
}

if [ "$LOCK_CHECKSUM" = "$STORED_CHECKSUM" ] && [ -d "node_modules/.pnpm" ]; then
  # Volume güncel — hiçbir şey yapma
  echo "✅ node_modules güncel (checksum eşleşiyor)."
elif [ -d "/deps/node_modules/.pnpm" ] && [ "$LOCK_CHECKSUM" = "$IMAGE_CHECKSUM" ]; then
  # Volume eski ama image doğru deps'e sahip → kopyala (hızlı)
  sync_from_image
elif [ -d "/deps/node_modules/.pnpm" ]; then
  # Image de eski — ama yine de image'dan başla, sonra update yap
  echo "⚠️  Hem volume hem image eski, image'dan senkronize edip güncelleniyor..."
  sync_from_image
  pnpm install --ignore-scripts
  echo "$LOCK_CHECKSUM" > node_modules/.lock-checksum
  echo "✅ Bağımlılıklar güncellendi!"
else
  # /deps/node_modules yok (eski image veya full stage) → fallback: pnpm install
  echo "🔄 node_modules yükleniyor (fallback)..."
  pnpm install --ignore-scripts
  echo "$LOCK_CHECKSUM" > node_modules/.lock-checksum
  echo "✅ Bağımlılıklar yüklendi!"
fi

# Prisma Client her zaman üret — schema değişikliklerinin yansıması için zorunlu
echo "🔧 Prisma Client oluşturuluyor..."
pnpm exec prisma generate
echo "✅ Prisma Client hazır!"

# ── Migration kontrolü ──
if [ "${SKIP_DB_MIGRATIONS}" = "1" ] || [ "${SKIP_DB_MIGRATIONS}" = "true" ]; then
  echo "⏭️  SKIP_DB_MIGRATIONS aktif: migration atlanıyor."
else
  echo "🔄 Veritabanı migration'ları uygulanıyor..."
  MIGRATE_OUTPUT=$(pnpm exec prisma migrate deploy 2>&1)
  MIGRATE_EXIT=$?

  if [ $MIGRATE_EXIT -eq 0 ]; then
    echo "✅ Migration'lar başarıyla uygulandı!"
  else
    echo "$MIGRATE_OUTPUT"
    # P3005: DB dolu ama _prisma_migrations tablosu yok → baseline uygula
    if echo "$MIGRATE_OUTPUT" | grep -q "P3005"; then
      echo "⚠️  Mevcut DB tespit edildi, baseline uygulanıyor..."
      MIGRATION_NAME=$(ls prisma/migrations | grep -v migration_lock | head -1 2>/dev/null | tr -d '\r')
      if [ -n "$MIGRATION_NAME" ]; then
        pnpm exec prisma migrate resolve --applied "$MIGRATION_NAME"
        echo "✅ Baseline uygulandı: $MIGRATION_NAME"
        # Baseline sonrası kalan migration'ları deploy et
        pnpm exec prisma migrate deploy
        echo "✅ Migration'lar başarıyla uygulandı!"
      else
        echo "⚠️  Migration bulunamadı, devam ediliyor..."
      fi
    else
      echo "❌ Migration hatası! Container durduruluyor."
      exit 1
    fi
  fi
fi

# Gelen komutu çalıştır (pnpm run dev gibi)
exec "$@"
