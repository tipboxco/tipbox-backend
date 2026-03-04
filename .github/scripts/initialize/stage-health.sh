#!/usr/bin/env bash
set -e

echo "🏥 Checking backend health..."
cd "$PROJECT_DIR" || exit 1

# 1. Önce backend container'ının ayağa kalkmasını bekle (running durumu)
echo "⏳ Waiting for backend container to start..."
for i in $(seq 1 20); do
  RUNNING=$(docker compose -f "$COMPOSE_FILE" ps backend 2>/dev/null | grep -E "Up|running" | head -1 || echo "")
  if [ -n "$RUNNING" ]; then
    echo "✅ Backend container is running"
    break
  fi
  if [ "$i" -eq 20 ]; then
    echo "❌ Backend container did not start"
    docker compose -f "$COMPOSE_FILE" logs --tail=50 backend
    exit 1
  fi
  echo "⏳ Waiting for container... ($i/20)"
  sleep 3
done

# 2. Docker healthcheck durumunu bekle (Dockerfile'daki HEALTHCHECK)
echo "⏳ Waiting for Docker healthcheck to pass..."
for i in $(seq 1 30); do
  HEALTH=$(docker inspect --format='{{.State.Health.Status}}' \
    "$(docker compose -f "$COMPOSE_FILE" ps -q backend 2>/dev/null)" 2>/dev/null || echo "none")
  if [ "$HEALTH" = "healthy" ]; then
    echo "✅ Docker healthcheck passed!"
    break
  elif [ "$HEALTH" = "unhealthy" ]; then
    echo "❌ Docker healthcheck reported unhealthy"
    docker compose -f "$COMPOSE_FILE" logs --tail=30 backend
    exit 1
  elif [ "$HEALTH" = "none" ] || [ -z "$HEALTH" ]; then
    # HEALTHCHECK tanımlı değilse direkt HTTP kontrol yap
    echo "ℹ️  No Docker healthcheck defined, falling back to HTTP check"
    break
  fi
  echo "⏳ Healthcheck status: $HEALTH ($i/30)"
  sleep 5
done

# 3. HTTP /health endpoint kontrolü
echo "🌐 Checking HTTP health endpoint..."
MAX_RETRIES=40
RETRY_COUNT=0
while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
  if docker compose -f "$COMPOSE_FILE" exec -T backend \
    node -e "require('http').get('http://localhost:3000/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})" 2>/dev/null; then
    echo "✅ Backend HTTP health check passed!"
    break
  fi

  RETRY_COUNT=$((RETRY_COUNT + 1))
  if [ $RETRY_COUNT -eq $MAX_RETRIES ]; then
    echo "⚠️ HTTP health check failed after $MAX_RETRIES attempts"
    echo "📋 Backend logs (last 40 lines):"
    docker compose -f "$COMPOSE_FILE" logs --tail=40 backend
    echo ""
    echo "📊 Container status:"
    docker compose -f "$COMPOSE_FILE" ps
    exit 1
  fi
  if [ $((RETRY_COUNT % 10)) -eq 0 ]; then
    echo "⏳ Waiting for HTTP health... ($RETRY_COUNT/$MAX_RETRIES)"
  fi
  sleep 3
done
