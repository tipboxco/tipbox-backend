
# Extract products_with_images.zip if it exists
if [ -f "src/scripts/tipbox-datas/products_with_images.zip" ]; then
  echo "Extracting products_with_images.zip..."
  unzip -o "src/scripts/tipbox-datas/products_with_images.zip" -d "src/scripts/tipbox-datas/"
  echo "ZIP dosyası başarıyla çıkarıldı."
else
  echo "products_with_images.zip dosyası bulunamadı, atlanıyor..."
fi

# Run migrations and start server
echo "Running database migrations..."
npx medusa db:migrate

echo "Seeding database..."
npx medusa user -e root@tipbox.co -p root@tipbox.co 
echo "Starting Medusa development server..."
npm run dev