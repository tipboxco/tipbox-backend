#!/bin/sh

# Ensure node_modules has all deps (fixes volume mount: named volume can be stale after rebuild)
if [ ! -d "node_modules/@xterm/xterm" ] || [ ! -d "node_modules/@medusajs/dashboard" ] || [ ! -d "node_modules/@medusajs/draft-order" ]; then
  echo "Installing/refreshing node_modules..."
  pnpm install
  echo "node_modules ready."
fi

# Wait for PostgreSQL to be ready
echo "Waiting for PostgreSQL to be ready..."
until PGPASSWORD=postgres psql -h postgres -U postgres -c '\q' 2>/dev/null; do
  echo "PostgreSQL is unavailable - sleeping"
  sleep 2
done
echo "PostgreSQL is ready!"

# Create medusa-store database if it doesn't exist
echo "Creating medusa-store database if not exists..."
PGPASSWORD=postgres psql -h postgres -U postgres -tc "SELECT 1 FROM pg_database WHERE datname = 'medusa-store'" | grep -q 1 || \
  PGPASSWORD=postgres psql -h postgres -U postgres -c "CREATE DATABASE \"medusa-store\""

echo "Database ready!"

# Extract product data if zip exists and not already extracted
SEED_DATA_DIR="/server/src/scripts/tipbox-datas"
ZIP_FILE="${SEED_DATA_DIR}/products_with_images.zip"
if [ -f "$ZIP_FILE" ]; then
  # Check if already extracted (look for any extracted folder/file)
  if [ ! -d "${SEED_DATA_DIR}/products" ] && [ ! -d "${SEED_DATA_DIR}/images" ]; then
    echo "Extracting products_with_images.zip..."
    unzip -o "$ZIP_FILE" -d "$SEED_DATA_DIR"
    echo "Extraction complete!"
  else
    echo "Product data already extracted, skipping..."
  fi
fi

# Run migrations and start server
echo "Running database migrations..."
npx medusa db:migrate
# Medusa admin user - sadece yoksa oluştur (duplicate key hatasını önler)
USER_EXISTS=$(PGPASSWORD=postgres psql -h postgres -U postgres -d medusa-store -tAc "SELECT 1 FROM \"user\" WHERE email='root@tipbox.co'" 2>/dev/null)
if [ "$USER_EXISTS" != "1" ]; then
  echo "Creating Medusa admin user..."
  npx medusa user -e root@tipbox.co -p root@tipbox.co 2>/dev/null || true
else
  echo "Medusa admin user already exists, skipping..."
fi

echo "Starting Medusa development server..."
pnpm run dev
