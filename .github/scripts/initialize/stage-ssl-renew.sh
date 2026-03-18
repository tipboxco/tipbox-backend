#!/usr/bin/env bash
set -e

echo "🔒 SSL certificate check & renewal..."
cd "$PROJECT_DIR" || exit 1

DOMAIN="api-test.tipbox.co"
EMAIL="admin@tipbox.co"

# Helper: certbot komutlarını doğru entrypoint ile çalıştır
run_certbot() {
  docker compose -f "$COMPOSE_FILE" run --rm --entrypoint "certbot" certbot "$@"
}

# Sertifika dizinini bul (certbot -0001 suffix ekleyebilir)
find_cert_path() {
  local found=""
  for dir in ./certbot/conf/live/${DOMAIN}*/; do
    if [ -f "${dir}fullchain.pem" ] && [ -f "${dir}privkey.pem" ]; then
      found="${dir}fullchain.pem"
    fi
  done
  echo "$found"
}

CERT_PATH=$(find_cert_path)

# 1. Sertifika kontrol et
if [ -z "$CERT_PATH" ]; then
  echo "⚠️  No SSL certificate found. Obtaining new certificate..."

  run_certbot certonly \
    --webroot \
    --webroot-path=/var/www/certbot \
    --email "$EMAIL" \
    --agree-tos \
    --no-eff-email \
    -d "$DOMAIN"

  echo "✅ New SSL certificate obtained!"
else
  # Sertifika var, süresini kontrol et
  EXPIRY_DATE=$(openssl x509 -in "$CERT_PATH" -noout -enddate 2>/dev/null | cut -d= -f2 || echo "")
  if [ -n "$EXPIRY_DATE" ]; then
    EXPIRY_EPOCH=$(date -d "$EXPIRY_DATE" +%s 2>/dev/null || echo "0")
    NOW_EPOCH=$(date +%s)
    DAYS_LEFT=$(( (EXPIRY_EPOCH - NOW_EPOCH) / 86400 ))

    echo "📋 Certificate expires: $EXPIRY_DATE ($DAYS_LEFT days left)"

    if [ "$DAYS_LEFT" -lt 30 ]; then
      echo "⚠️  Certificate expires in less than 30 days. Cleaning up and renewing..."

      # Tüm eski sertifikaları sil (-0001 suffix sorununu önle)
      run_certbot delete --cert-name "$DOMAIN" --non-interactive 2>/dev/null || true
      # -0001 gibi suffix'li olanları da temizle
      for cert_name in $(run_certbot certificates 2>/dev/null | grep "Certificate Name:" | awk '{print $3}' | grep "^${DOMAIN}"); do
        run_certbot delete --cert-name "$cert_name" --non-interactive 2>/dev/null || true
      done

      # Temiz sertifika al (doğru path'e yazılır)
      run_certbot certonly \
        --webroot \
        --webroot-path=/var/www/certbot \
        --email "$EMAIL" \
        --agree-tos \
        --no-eff-email \
        -d "$DOMAIN"

      echo "✅ Certificate renewed!"
    else
      echo "✅ Certificate is valid for $DAYS_LEFT more days. No renewal needed."
    fi
  else
    echo "⚠️  Could not read certificate expiry. Running renewal check..."
    run_certbot renew --quiet
  fi
fi

# 2. Certbot container'ı başlat (arka planda 12 saatte bir renewal)
echo "⏳ Ensuring certbot container is running..."
docker compose -f "$COMPOSE_FILE" up -d certbot 2>/dev/null || true

# 3. Nginx'i reload et (yeni sertifikayı alsın)
echo "🔄 Reloading nginx to pick up SSL certificate..."
docker compose -f "$COMPOSE_FILE" exec -T nginx sh -c '
  if [ -x /docker-entrypoint.d/40-ssl-init.sh ]; then
    /docker-entrypoint.d/40-ssl-init.sh
  fi
  nginx -s reload 2>/dev/null || true
'

# 4. HTTPS kontrolü
echo "🌐 Checking HTTPS endpoint..."
sleep 3
for i in $(seq 1 5); do
  if curl -sSf --max-time 10 "https://${DOMAIN}/health" > /dev/null 2>&1; then
    echo "✅ HTTPS is working!"
    exit 0
  fi
  echo "⏳ Waiting for HTTPS... ($i/5)"
  sleep 3
done

echo "⚠️  HTTPS not responding yet. Check nginx logs for details."
echo "    Manual fix: ssh into server and run ./cert-init.sh --revoke-old"
