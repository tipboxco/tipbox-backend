#!/bin/sh

INIT_MARKER="/tmp/.catalog_init_done"

# Parse DATABASE_URL for PostgreSQL credentials
# Format: postgresql://user:password@host:port/dbname
DB_USER=$(echo "$DATABASE_URL" | sed -n 's|postgresql://\([^:]*\):.*|\1|p')
DB_PASS=$(echo "$DATABASE_URL" | sed -n 's|postgresql://[^:]*:\([^@]*\)@.*|\1|p')
DB_HOST=$(echo "$DATABASE_URL" | sed -n 's|.*@\([^:/]*\).*|\1|p')

# ── node_modules kontrolü ──
# Build aşamasında deps /server-deps'e yüklendi.
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
if [ -f "/server-deps/.lock-checksum" ]; then
  IMAGE_CHECKSUM=$(cat /server-deps/.lock-checksum)
fi

sync_from_image() {
  echo "📦 Build cache'den node_modules senkronize ediliyor..."
  rm -rf node_modules/.pnpm node_modules/.modules.yaml node_modules/.lock-checksum 2>/dev/null || true
  cp -a /server-deps/. node_modules/
  echo "✅ Bağımlılıklar senkronize edildi (build cache)!"
}

if [ "$LOCK_CHECKSUM" = "$STORED_CHECKSUM" ] && [ -d "node_modules/.pnpm" ]; then
  echo "✅ node_modules güncel (checksum eşleşiyor)."
elif [ -d "/server-deps/.pnpm" ] && [ "$LOCK_CHECKSUM" = "$IMAGE_CHECKSUM" ]; then
  sync_from_image
elif [ -d "/server-deps/.pnpm" ]; then
  echo "⚠️  Hem volume hem image eski, image'dan senkronize edip güncelleniyor..."
  sync_from_image
  pnpm install
  echo "$LOCK_CHECKSUM" > node_modules/.lock-checksum
  echo "✅ Bağımlılıklar güncellendi!"
else
  echo "🔄 node_modules yükleniyor (fallback)..."
  pnpm install
  echo "$LOCK_CHECKSUM" > node_modules/.lock-checksum
  echo "✅ Bağımlılıklar yüklendi!"
fi

# Wait for PostgreSQL to be ready
echo "Waiting for PostgreSQL to be ready (user: $DB_USER, host: $DB_HOST)..."
until PGPASSWORD="$DB_PASS" psql -h "$DB_HOST" -U "$DB_USER" -d postgres -c '\q' 2>/dev/null; do
  echo "PostgreSQL is unavailable - sleeping"
  sleep 2
done
echo "PostgreSQL is ready!"

# Run one-time initialization only if not already done
if [ ! -f "$INIT_MARKER" ]; then
  # Create medusa-store database if it doesn't exist
  echo "Creating medusa-store database if not exists..."
  PGPASSWORD="$DB_PASS" psql -h "$DB_HOST" -U "$DB_USER" -d postgres -tc "SELECT 1 FROM pg_database WHERE datname = 'medusa-store'" | grep -q 1 || \
    PGPASSWORD="$DB_PASS" psql -h "$DB_HOST" -U "$DB_USER" -d postgres -c "CREATE DATABASE \"medusa-store\""
  echo "Database ready!"

  # Extract product data if zip exists and not already extracted
  SEED_DATA_DIR="/server/src/scripts/tipbox-datas"
  ZIP_FILE="${SEED_DATA_DIR}/products_with_images.zip"
  if [ -f "$ZIP_FILE" ]; then
    if [ ! -d "${SEED_DATA_DIR}/products" ] && [ ! -d "${SEED_DATA_DIR}/images" ]; then
      echo "Extracting products_with_images.zip..."
      unzip -o "$ZIP_FILE" -d "$SEED_DATA_DIR"
      echo "Extraction complete!"
    else
      echo "Product data already extracted, skipping..."
    fi
  fi

  # Run migrations
  echo "Running database migrations..."
  npx medusa db:migrate

  # Medusa admin user (zaten varsa hata vermez)
  npx medusa user -e root@tipbox.co -p root@tipbox.co 2>/dev/null || true

  touch "$INIT_MARKER"
  echo "Initialization complete."
else
  echo "Skipping initialization (already done). Running migrations only..."
  npx medusa db:migrate
fi

echo "Starting Medusa development server..."
exec pnpm run dev
