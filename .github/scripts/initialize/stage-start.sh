#!/usr/bin/env bash
set -e

cd "$PROJECT_DIR" || exit 1

SERVICES=$(echo "$CHANGED_SERVICES" | xargs)

# ═══════════════════════════════════════════════════════════════════
# SELECTIVE MODE: Sadece değişen servisler restart edilir
# Core servisler (postgres, redis, minio) dokunulmaz → downtime yok
# ═══════════════════════════════════════════════════════════════════
if [ "$INFRA_CHANGED" != "true" ] && [ -n "$SERVICES" ]; then
  echo "🚀 Selective restart: $SERVICES"
  echo "   Core services (postgres, redis, minio) untouched"
  echo ""

  # 1. Core servislerin sağlıklı olduğunu doğrula (zaten çalışıyor olmalılar)
  echo "⏳ Verifying core services are healthy..."
  for i in $(seq 1 10); do
    PG=$(docker compose -f "$COMPOSE_FILE" ps postgres 2>/dev/null | grep -c "healthy" || true)
    RD=$(docker compose -f "$COMPOSE_FILE" ps redis   2>/dev/null | grep -c "healthy" || true)
    MN=$(docker compose -f "$COMPOSE_FILE" ps minio   2>/dev/null | grep -c "healthy" || true)
    if [ "$PG" -ge 1 ] && [ "$RD" -ge 1 ] && [ "$MN" -ge 1 ]; then
      echo "✅ Core services are healthy"
      break
    fi
    if [ "$i" -eq 10 ]; then
      echo "❌ Core services not healthy — falling back to full restart"
      exec bash "$PROJECT_DIR/.github/scripts/initialize/stage-start.sh"
    fi
    echo "  ⏳ postgres=$PG redis=$RD minio=$MN ($i/10)"
    sleep 3
  done

  # 2. Migration: sadece backend değiştiyse çalıştır
  if echo " $SERVICES " | grep -q " backend "; then
    echo "🔄 Backend changed — running migrations..."
    docker compose -f "$COMPOSE_FILE" run --rm --no-deps \
      -e SKIP_DB_MIGRATIONS=1 \
      backend \
      sh -c '
        MIGRATE_OUTPUT=$(pnpm exec prisma migrate deploy 2>&1)
        MIGRATE_EXIT=$?
        echo "$MIGRATE_OUTPUT"
        if [ $MIGRATE_EXIT -eq 0 ]; then
          echo "✅ Migrations applied successfully"
          exit 0
        fi
        if echo "$MIGRATE_OUTPUT" | grep -q "P3005"; then
          echo "⚠️  P3005 detected — applying baseline..."
          FIRST_MIGRATION=$(ls prisma/migrations 2>/dev/null | grep -v migration_lock | sort | head -1 | tr -d "\r")
          if [ -z "$FIRST_MIGRATION" ]; then
            echo "❌ No migrations found for baseline"
            exit 1
          fi
          echo "🔧 Baseline: $FIRST_MIGRATION"
          pnpm exec prisma migrate resolve --applied "$FIRST_MIGRATION"
          pnpm exec prisma migrate deploy
          echo "✅ Baseline + migrations applied"
          exit 0
        fi
        echo "❌ Migration failed"
        exit $MIGRATE_EXIT
      '
    echo "✅ Migration stage complete"
  else
    echo "⏭️  Backend not changed — skipping migrations"
  fi

  # 3. Sadece değişen servisleri yeniden oluştur
  echo "🔄 Recreating changed services: $SERVICES"
  docker compose -f "$COMPOSE_FILE" up -d --force-recreate --no-deps $SERVICES
  echo "✅ Changed services restarted"
  exit 0
fi

# ═══════════════════════════════════════════════════════════════════
# FULL MODE: Altyapı değişti veya tüm servisler → tam restart
# ═══════════════════════════════════════════════════════════════════
echo "🚀 Full restart (infrastructure change detected)"

# 1. Core servisleri başlat
echo "⏳ Starting core services (postgres, redis, minio)..."
docker compose -f "$COMPOSE_FILE" up -d postgres redis minio

# 2. Core servislerin healthy olmasını bekle
echo "⏳ Waiting for core services to become healthy..."
for i in $(seq 1 30); do
  PG=$(docker compose -f "$COMPOSE_FILE" ps postgres 2>/dev/null | grep -c "healthy" || true)
  RD=$(docker compose -f "$COMPOSE_FILE" ps redis   2>/dev/null | grep -c "healthy" || true)
  MN=$(docker compose -f "$COMPOSE_FILE" ps minio   2>/dev/null | grep -c "healthy" || true)
  if [ "$PG" -ge 1 ] && [ "$RD" -ge 1 ] && [ "$MN" -ge 1 ]; then
    echo "✅ Core services are healthy"
    break
  fi
  if [ "$i" -eq 30 ]; then
    echo "❌ Core services did not become healthy in time"
    docker compose -f "$COMPOSE_FILE" ps
    exit 1
  fi
  echo "  ⏳ postgres=$PG redis=$RD minio=$MN healthy ($i/30)"
  sleep 5
done

# 3. Migration'ı izole container'da çalıştır
echo "🔄 Running database migrations in isolated container..."
docker compose -f "$COMPOSE_FILE" run --rm --no-deps \
  -e SKIP_DB_MIGRATIONS=1 \
  backend \
  sh -c '
    MIGRATE_OUTPUT=$(pnpm exec prisma migrate deploy 2>&1)
    MIGRATE_EXIT=$?
    echo "$MIGRATE_OUTPUT"
    if [ $MIGRATE_EXIT -eq 0 ]; then
      echo "✅ Migrations applied successfully"
      exit 0
    fi
    if echo "$MIGRATE_OUTPUT" | grep -q "P3005"; then
      echo "⚠️  P3005 detected: existing DB without migration history. Applying baseline..."
      FIRST_MIGRATION=$(ls prisma/migrations 2>/dev/null | grep -v migration_lock | sort | head -1 | tr -d "\r")
      if [ -z "$FIRST_MIGRATION" ]; then
        echo "❌ No migrations found for baseline"
        exit 1
      fi
      echo "🔧 Baseline: $FIRST_MIGRATION"
      pnpm exec prisma migrate resolve --applied "$FIRST_MIGRATION"
      pnpm exec prisma migrate deploy
      echo "✅ Baseline + migrations applied"
      exit 0
    fi
    echo "❌ Migration failed (non-P3005 error)"
    exit $MIGRATE_EXIT
  '
echo "✅ Migration stage complete"

# 4. Tüm servisleri başlat
docker compose -f "$COMPOSE_FILE" up -d
echo "✅ All services started (health verification in next stage)"
