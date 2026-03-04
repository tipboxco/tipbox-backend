#!/bin/sh
set -e

# ── node_modules kontrolü ──
# Named volume boş olabilir (ilk çalıştırma veya volume silindiğinde)
if [ ! -d "node_modules/.prisma" ] || [ ! -d "node_modules/@prisma/client" ]; then
  echo "🔄 node_modules eksik, yükleniyor..."
  pnpm install
  pnpm exec prisma generate
  echo "✅ Bağımlılıklar ve Prisma Client hazır!"
fi

# ── Migration kontrolü ──
if [ "${SKIP_DB_MIGRATIONS}" = "1" ] || [ "${SKIP_DB_MIGRATIONS}" = "true" ]; then
  echo "⏭️  SKIP_DB_MIGRATIONS aktif: migration/db push atlanıyor."
else
  echo "🔄 Veritabanı migration'ları uygulanıyor..."
  if npx prisma db push --skip-generate 2>&1; then
    echo "✅ Migration'lar başarıyla uygulandı!"
  else
    echo "⚠️  db push başarısız, migrate deploy deneniyor..."
    npx prisma migrate deploy || echo "⚠️  Migration hatası, devam ediliyor..."
  fi
fi

# Gelen komutu çalıştır (pnpm run dev gibi)
exec "$@"
