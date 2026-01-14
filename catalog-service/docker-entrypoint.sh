#!/bin/bash
# Unzip products_with_images.zip if it exists
[ -f src/scripts/tipbox-datas/products_with_images.zip ] && unzip -o src/scripts/tipbox-datas/products_with_images.zip -d src/scripts/tipbox-datas/

echo "Running database migrations..."
npx medusa db:migrate

echo "Creating root user..."
npx medusa user --email root@tipbox.co --password root@tipbox.co || true

echo "Starting Medusa development server..."
npm run develop
