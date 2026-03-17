#!/bin/sh
set -e

# ── node_modules kontrolü ──
# Build aşamasında deps /app-deps'e yüklendi.
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
if [ -f "/app-deps/.lock-checksum" ]; then
  IMAGE_CHECKSUM=$(cat /app-deps/.lock-checksum)
fi

sync_from_image() {
  echo "📦 Build cache'den node_modules senkronize ediliyor..."
  rm -rf node_modules/.pnpm node_modules/.modules.yaml node_modules/.lock-checksum 2>/dev/null || true
  cp -a /app-deps/. node_modules/
  echo "✅ Bağımlılıklar senkronize edildi (build cache)!"
}

if [ "$LOCK_CHECKSUM" = "$STORED_CHECKSUM" ] && [ -d "node_modules/.pnpm" ]; then
  echo "✅ node_modules güncel (checksum eşleşiyor)."
elif [ -d "/app-deps/.pnpm" ] && [ "$LOCK_CHECKSUM" = "$IMAGE_CHECKSUM" ]; then
  sync_from_image
elif [ -d "/app-deps/.pnpm" ]; then
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

# Gelen komutu çalıştır (pnpm run dev gibi)
exec "$@"
