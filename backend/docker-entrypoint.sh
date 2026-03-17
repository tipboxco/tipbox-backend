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
# pnpm-lock.yaml checksum'ı ile paket değişikliklerini tespit et
LOCK_CHECKSUM=""
if [ -f "pnpm-lock.yaml" ]; then
  LOCK_CHECKSUM=$(md5sum pnpm-lock.yaml | cut -d' ' -f1)
fi
STORED_CHECKSUM=""
if [ -f "node_modules/.lock-checksum" ]; then
  STORED_CHECKSUM=$(cat node_modules/.lock-checksum)
fi

install_deps() {
  pnpm install --ignore-scripts
  echo "$LOCK_CHECKSUM" > node_modules/.lock-checksum
}

if [ ! -d "node_modules/.pnpm" ]; then
  echo "🔄 node_modules eksik, yükleniyor..."
  install_deps
  echo "✅ Bağımlılıklar yüklendi!"
elif [ "$LOCK_CHECKSUM" != "$STORED_CHECKSUM" ]; then
  echo "🔄 pnpm-lock.yaml değişti, paketler güncelleniyor..."
  install_deps
  echo "✅ Bağımlılıklar güncellendi!"
else
  echo "✅ node_modules checksum eşleşiyor."
fi

# ── Kurulum doğrulama ──
# Named volume bozuk/eksik paket içerebilir — kritik paketleri kontrol et
MISSING_PKGS=""
for pkg in express expo-server-sdk bullmq socket.io @prisma/client; do
  if [ ! -d "node_modules/$pkg" ] && [ ! -L "node_modules/$pkg" ]; then
    MISSING_PKGS="$MISSING_PKGS $pkg"
  fi
done

if [ -n "$MISSING_PKGS" ]; then
  echo "⚠️  Eksik paketler tespit edildi:$MISSING_PKGS"
  echo "🔄 node_modules temizlenip yeniden yükleniyor..."
  rm -rf node_modules/.pnpm node_modules/.lock-checksum
  install_deps
  echo "✅ Bağımlılıklar temiz kurulumla yüklendi!"
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
