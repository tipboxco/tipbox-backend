#!/usr/bin/env bash
set -e

echo "🚀 Starting test environment deployment..."
echo "📌 Deploying branch: $DEPLOY_BRANCH"
cd "$PROJECT_DIR" || { echo "❌ Project directory not found: $PROJECT_DIR"; exit 1; }
echo "📥 Pulling latest changes from branch: $DEPLOY_BRANCH"
git fetch origin
git checkout "$DEPLOY_BRANCH"
echo "🧹 Cleaning local changes..."
git reset --hard "origin/$DEPLOY_BRANCH"
git clean -fd -e ".env*" -e "backups/"
if [ ! -f "$ENV_FILE" ]; then
  echo "❌ $ENV_FILE file not found! Please create it first."
  echo "📋 Available env files:"
  ls -la "$PROJECT_DIR"/.env* 2>/dev/null || echo "  No .env files found"
  exit 1
fi
echo "✅ Preparation completed"
