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

install_deps() {
  pnpm install
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
for pkg in react react-dom vite; do
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

# Gelen komutu çalıştır (pnpm run dev gibi)
exec "$@"
