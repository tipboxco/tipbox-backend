#!/bin/bash

# Swagger Endpoint Kontrol ve Yenileme Script'i
# Bu script yeni endpoint ekledikten sonra Swagger'ın güncel olmasını sağlar

echo "🔍 Swagger Endpoint Kontrolü..."
echo ""

# Backend container'ının çalışıp çalışmadığını kontrol et
if ! docker-compose ps | grep -q "backend.*Up"; then
    echo "❌ Backend container çalışmıyor. Başlatılıyor..."
    docker-compose up -d backend
    sleep 5
fi

# TypeScript'i derle
echo "📦 TypeScript dosyaları derleniyor..."
docker-compose exec backend npm run build

# Container'ı restart et
echo "🔄 Backend container restart ediliyor..."
docker-compose restart backend

# Backend'in başlaması için bekle
echo "⏳ Backend başlatılıyor (10 saniye bekleniyor)..."
sleep 10

# Swagger JSON'u kontrol et
echo ""
echo "✅ Swagger endpoint'leri kontrol ediliyor..."
SWAGGER_PATHS=$(curl -s http://localhost:3000/api-docs/swagger.json | jq -r '.paths | keys[]' 2>/dev/null)

if [ -z "$SWAGGER_PATHS" ]; then
    echo "❌ Swagger JSON alınamadı. Backend çalışıyor mu kontrol edin."
    exit 1
fi

echo ""
echo "📋 Tüm endpoint'ler:"
echo "$SWAGGER_PATHS" | sort

echo ""
echo "📊 Endpoint sayısı:"
echo "$SWAGGER_PATHS" | wc -l

echo ""
echo "🔐 Auth endpoint'leri:"
echo "$SWAGGER_PATHS" | grep -E "(auth|login|signup|verify|forgot|reset)" | sort

echo ""
echo "✅ İşlem tamamlandı!"
echo "🌐 Swagger UI: http://localhost:3000/api-docs"
echo "📄 Swagger JSON: http://localhost:3000/api-docs/swagger.json"
echo ""
echo "💡 Swagger UI'da endpoint'leri görmek için tarayıcınızda hard refresh yapın:"
echo "   - Chrome/Edge: Ctrl+Shift+R (Windows) veya Cmd+Shift+R (Mac)"
echo "   - Firefox: Ctrl+F5 (Windows) veya Cmd+Shift+R (Mac)"

