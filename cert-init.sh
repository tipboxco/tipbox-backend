#!/bin/bash
# =============================================================================
# SSL Sertifika Kurulum & Yenileme Script'i
# api-test.tipbox.co için Let's Encrypt sertifikası
#
# Kullanım:
#   İlk kurulum:        ./cert-init.sh
#   Eski iptal + yeni:  ./cert-init.sh --revoke-old
#   Sadece yenileme:    ./cert-init.sh --renew
# =============================================================================

set -euo pipefail

DOMAIN="api-test.tipbox.co"
EMAIL="admin@tipbox.co"
COMPOSE_FILE="docker-compose.test.yml"
CERT_DIR="./certbot/conf/live/${DOMAIN}"

# Renk kodları
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_info()  { echo -e "${GREEN}[INFO]${NC}  $1"; }
log_warn()  { echo -e "${YELLOW}[WARN]${NC}  $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Helper: certbot komutlarını doğru entrypoint ile çalıştır
# (docker-compose'daki certbot servisi custom entrypoint kullanıyor,
#  one-off komutlar için --entrypoint override gerekli)
run_certbot() {
  docker compose -f "${COMPOSE_FILE}" run --rm --entrypoint "certbot" certbot "$@"
}

# ── Eski sertifikayı iptal et ──
revoke_old_cert() {
  if [ -f "${CERT_DIR}/fullchain.pem" ]; then
    log_info "Eski sertifika iptal ediliyor..."
    run_certbot revoke \
      --cert-path "/etc/letsencrypt/live/${DOMAIN}/fullchain.pem" \
      --non-interactive \
      --reason superseded 2>/dev/null || log_warn "Eski sertifika zaten iptal edilmiş veya bulunamadı."

    # Eski sertifika dosyalarını temizle
    run_certbot delete \
      --cert-name "${DOMAIN}" \
      --non-interactive 2>/dev/null || true

    log_info "Eski sertifika iptal edildi ve temizlendi."
  else
    log_warn "İptal edilecek eski sertifika bulunamadı."
  fi
}

# ── Yeni sertifika al ──
obtain_new_cert() {
  log_info "Nginx'in HTTP modunda çalıştığından emin olunuyor..."
  docker compose -f "${COMPOSE_FILE}" up -d nginx
  sleep 3

  log_info "${DOMAIN} için yeni Let's Encrypt sertifikası alınıyor..."
  run_certbot certonly \
    --webroot \
    --webroot-path=/var/www/certbot \
    --email "${EMAIL}" \
    --agree-tos \
    --no-eff-email \
    --force-renewal \
    -d "${DOMAIN}"

  if [ $? -eq 0 ]; then
    log_info "Sertifika başarıyla alındı!"
  else
    log_error "Sertifika alınamadı!"
    exit 1
  fi
}

# ── Nginx'i yeniden başlat (HTTPS aktif) ──
restart_nginx() {
  log_info "Nginx yeniden başlatılıyor (HTTPS aktif olacak)..."
  docker compose -f "${COMPOSE_FILE}" restart nginx
  sleep 2

  # HTTPS kontrolü
  if curl -sSf --max-time 10 "https://${DOMAIN}/health" > /dev/null 2>&1; then
    log_info "HTTPS aktif ve çalışıyor!"
  else
    log_warn "HTTPS henüz yanıt vermiyor. DNS propagasyonu veya firewall kontrol edin."
    log_info "HTTP kontrol ediliyor..."
    if curl -sSf --max-time 10 "http://${DOMAIN}/health" > /dev/null 2>&1; then
      log_info "HTTP çalışıyor. HTTPS için nginx loglarını kontrol edin."
    fi
  fi
}

# ── Sertifika bilgilerini göster ──
show_cert_info() {
  if [ -f "${CERT_DIR}/fullchain.pem" ]; then
    log_info "Sertifika bilgileri:"
    echo "---"
    run_certbot certificates 2>/dev/null || \
      openssl x509 -in "${CERT_DIR}/fullchain.pem" -noout -dates -subject 2>/dev/null || true
    echo "---"
  fi
}

# ── Sadece yenileme (certbot renew) ──
renew_cert() {
  log_info "Sertifika yenileme kontrolü yapılıyor..."
  run_certbot renew --quiet
  docker compose -f "${COMPOSE_FILE}" restart nginx
  show_cert_info
  log_info "Yenileme tamamlandı."
}

# ── Ana akış ──
main() {
  case "${1:-}" in
    --revoke-old)
      log_info "=== Eski sertifika iptal + yeni sertifika alınıyor ==="
      revoke_old_cert
      obtain_new_cert
      restart_nginx
      show_cert_info
      ;;
    --renew)
      renew_cert
      ;;
    *)
      log_info "=== Let's Encrypt SSL sertifika kurulumu ==="

      # Eğer mevcut sertifika varsa uyar
      if [ -f "${CERT_DIR}/fullchain.pem" ]; then
        log_warn "Mevcut sertifika bulundu. Eski sertifikayı iptal edip yenisini almak için:"
        log_warn "  ./cert-init.sh --revoke-old"
        log_warn ""
        log_warn "Devam ediliyor (force-renewal ile yeni sertifika alınacak)..."
      fi

      obtain_new_cert
      restart_nginx
      show_cert_info
      ;;
  esac

  echo ""
  log_info "Otomatik yenileme: certbot container'ı her 12 saatte bir kontrol eder."
  log_info "Nginx her 6 saatte bir reload olur ve yeni sertifikayı alır."
  log_info "Let's Encrypt sertifikaları 90 gün geçerlidir, 60. günde otomatik yenilenir."
}

main "$@"
