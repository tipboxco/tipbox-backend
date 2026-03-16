#!/usr/bin/env bash
# Inputs (env vars from caller):
#   EVENT_NAME  - github.event_name
#   OUTPUT_FILE - path to write outputs (GITHUB_OUTPUT)
#
# Outputs:
#   backend=true/false        - backend/ klasöründe değişiklik var mı
#   admin=true/false           - admin-panel/ klasöründe değişiklik var mı
#   catalog=true/false         - catalog-service/ klasöründe değişiklik var mı
#   changed_services="..."     - boşlukla ayrılmış servis listesi (boş = tümü)
#   infra_changed=true/false   - compose/nginx/Dockerfile gibi altyapı dosyaları değişti mi
#   needs_deploy=true/false    - deployment gerekli mi (sadece docs değiştiyse false)

set -e

# ── workflow_dispatch: tüm servisleri build et ──
if [ "$EVENT_NAME" = "workflow_dispatch" ]; then
  echo "📋 Manual dispatch — building all services"
  {
    echo "backend=true"
    echo "admin=true"
    echo "catalog=true"
    echo "changed_services="
    echo "infra_changed=true"
    echo "needs_deploy=true"
  } >> "$OUTPUT_FILE"
  exit 0
fi

# ── Push event: değişen dosyaları tespit et ──
CHANGED=$(git diff --name-only HEAD~1 HEAD)
echo "📁 Changed files:"
echo "$CHANGED"
echo "---"

BACKEND=false
ADMIN=false
CATALOG=false
INFRA_CHANGED=false
SERVICES=""

# ── Servis bazlı değişiklik tespiti ──
if echo "$CHANGED" | grep -q "^backend/"; then
  BACKEND=true
  SERVICES="$SERVICES backend"
fi
if echo "$CHANGED" | grep -q "^admin-panel/"; then
  ADMIN=true
  SERVICES="$SERVICES admin-panel"
fi
if echo "$CHANGED" | grep -q "^catalog-service/"; then
  CATALOG=true
  SERVICES="$SERVICES catalog-service"
fi

# ── Altyapı değişikliği tespiti ──
# docker-compose, nginx, .github, root Dockerfile, root config → infra change
if echo "$CHANGED" | grep -qE "^(docker-compose|nginx|\.github/|Dockerfile)"; then
  echo "⚠️  Infrastructure config changed"
  INFRA_CHANGED=true
  # Infra değişince tüm servisleri build et
  BACKEND=true
  ADMIN=true
  CATALOG=true
  SERVICES=""
fi

# Root package.json, .env, .npmrc gibi dosyalar → infra change
if echo "$CHANGED" | grep -qE "^(package\.json|pnpm-lock|\.env|\.npmrc|pnpm-workspace)"; then
  echo "⚠️  Root config files changed"
  INFRA_CHANGED=true
  BACKEND=true
  ADMIN=true
  CATALOG=true
  SERVICES=""
fi

# ── Deploy gerekli mi? ──
# Sadece docs/README değiştiyse deployment gerekmez
NEEDS_DEPLOY=true
DEPLOY_FILES=$(echo "$CHANGED" | grep -cvE "^(README|docs/|LICENSE|\.md$)" || true)
if [ "$DEPLOY_FILES" -eq 0 ]; then
  echo "ℹ️  Only documentation files changed — skipping deployment"
  NEEDS_DEPLOY=false
fi

# Hiçbir servis + infra değişmediyse → deploy gerekmez
if [ "$BACKEND" = "false" ] && [ "$ADMIN" = "false" ] && [ "$CATALOG" = "false" ] && [ "$INFRA_CHANGED" = "false" ]; then
  echo "ℹ️  No deployable service changes detected"
  NEEDS_DEPLOY=false
fi

# ── Outputs ──
SERVICES_TRIMMED=$(echo "$SERVICES" | xargs)
{
  echo "backend=$BACKEND"
  echo "admin=$ADMIN"
  echo "catalog=$CATALOG"
  echo "changed_services=$SERVICES_TRIMMED"
  echo "infra_changed=$INFRA_CHANGED"
  echo "needs_deploy=$NEEDS_DEPLOY"
} >> "$OUTPUT_FILE"

# ── Summary ──
echo ""
echo "📊 Detection Summary:"
echo "   Backend:          $BACKEND"
echo "   Admin Panel:      $ADMIN"
echo "   Catalog Service:  $CATALOG"
echo "   Infra Changed:    $INFRA_CHANGED"
echo "   Needs Deploy:     $NEEDS_DEPLOY"
echo "   Services to build: ${SERVICES_TRIMMED:-all}"
