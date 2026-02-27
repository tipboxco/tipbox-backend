#!/usr/bin/env bash
# Repo kökünden çalıştırın: bash scripts/sync-badge-images-from-minio.sh
# MinIO badges/custom görsellerini Badge tablosu ile eşleştirir.
set -e
cd "$(dirname "$0")/../backend"
exec pnpm run sync-badge-images
