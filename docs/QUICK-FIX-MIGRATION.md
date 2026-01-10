# 🚨 Acil: Test Sunucusunda Failed Migration

## Tek Komutla Çöz (En Hızlı)

Yerel bilgisayarından çalıştır:

```bash
npm run db:fix-failed-migration-remote
```

## Manuel SSH ile Çöz

```bash
ssh hetzner-deploy
cd /opt/tipbox-backend
docker compose -f docker-compose.test.yml exec -T postgres psql -U tipbox_user -d tipbox_test -c "DELETE FROM _prisma_migrations WHERE migration_name = '20260109132600_add_notification_settings' AND finished_at IS NULL;"
docker compose -f docker-compose.test.yml run --rm backend npx prisma migrate deploy
```

## Sonra Deploy'u Tekrar Başlat

GitHub Actions artık otomatik halledecek.

---

Detaylı bilgi için: [FIX-FAILED-MIGRATION-GUIDE.md](./FIX-FAILED-MIGRATION-GUIDE.md)

