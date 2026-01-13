
# Run migrations and start server
echo "Running database migrations..."
npx medusa db:migrate

echo "Seeding database..."
npx medusa user -e root@tipbox.co -p root@tipbox.co 
echo "Starting Medusa development server..."
npm run dev