#!/bin/sh
set -e

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

if [ ! -d "node_modules/.pnpm" ]; then
  echo "🔄 node_modules eksik, yükleniyor..."
  pnpm install
  echo "$LOCK_CHECKSUM" > node_modules/.lock-checksum
  echo "✅ Bağımlılıklar yüklendi!"
elif [ "$LOCK_CHECKSUM" != "$STORED_CHECKSUM" ]; then
  echo "🔄 pnpm-lock.yaml değişti, paketler güncelleniyor..."
  pnpm install
  echo "$LOCK_CHECKSUM" > node_modules/.lock-checksum
  echo "✅ Bağımlılıklar güncellendi!"
else
  echo "✅ node_modules güncel."
fi

# Gelen komutu çalıştır (pnpm run dev gibi)
exec "$@"
