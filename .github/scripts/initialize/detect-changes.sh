#!/usr/bin/env bash
# Inputs (env vars from caller):
#   EVENT_NAME  - github.event_name
#   OUTPUT_FILE - path to write outputs (GITHUB_OUTPUT)

set -e

# workflow_dispatch ise tüm servisleri build et
if [ "$EVENT_NAME" = "workflow_dispatch" ]; then
  echo "📋 Manual dispatch - building all services"
  echo "backend=true" >> "$OUTPUT_FILE"
  echo "admin=true" >> "$OUTPUT_FILE"
  echo "catalog=true" >> "$OUTPUT_FILE"
  echo "changed_services=" >> "$OUTPUT_FILE"
  exit 0
fi

CHANGED=$(git diff --name-only HEAD~1 HEAD)
echo "Changed files:"
echo "$CHANGED"

BACKEND=false
ADMIN=false
CATALOG=false
SERVICES=""

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

# docker-compose veya workflow dosyaları değiştiyse tümünü build et
if echo "$CHANGED" | grep -qE "^docker-compose|^\.github/"; then
  echo "⚠️  Shared config changed - building all services"
  SERVICES=""
fi

echo "backend=$BACKEND" >> "$OUTPUT_FILE"
echo "admin=$ADMIN" >> "$OUTPUT_FILE"
echo "catalog=$CATALOG" >> "$OUTPUT_FILE"
echo "changed_services=$(echo $SERVICES | xargs)" >> "$OUTPUT_FILE"
echo "Services to build: $(echo $SERVICES | xargs || echo 'all')"
