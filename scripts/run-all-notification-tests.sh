#!/bin/bash

# Tüm bildirim testlerini tek seferde çalıştır
# Kullanım: docker-compose exec backend bash scripts/run-all-notification-tests.sh

echo "═══════════════════════════════════════════════════════"
echo "🚀 Tüm Bildirim Testleri Başlatılıyor"
echo "═══════════════════════════════════════════════════════"
echo ""

# Test dosyaları dizini
TEST_DIR="src/tests/notificationtest"

# Test dosyaları (sırayla çalıştırılacak)
TESTS=(
  "notification.post.test.ts"
  "notification.comment.test.ts"
  "notification.trust.test.ts"
  "notification.message.test.ts"
  "notification.gamification.test.ts"
  "notification.expert.test.ts"
  "notification.collection.test.ts"
  "notification.event.test.ts"
  "notification.system.test.ts"
)

# Başarılı ve başarısız test sayıları
SUCCESS_COUNT=0
FAIL_COUNT=0
TOTAL_COUNT=${#TESTS[@]}

# Her testi çalıştır
for test in "${TESTS[@]}"; do
  echo ""
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "📋 Çalıştırılıyor: $test"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo ""
  
  if npx ts-node "$TEST_DIR/$test"; then
    echo ""
    echo "✅ $test başarıyla tamamlandı"
    ((SUCCESS_COUNT++))
  else
    echo ""
    echo "❌ $test başarısız oldu"
    ((FAIL_COUNT++))
  fi
  
  echo ""
  sleep 2  # Testler arası kısa bir bekleme
done

# Özet rapor
echo ""
echo "═══════════════════════════════════════════════════════"
echo "📊 TEST ÖZET RAPORU"
echo "═══════════════════════════════════════════════════════"
echo ""
echo "Toplam Test: $TOTAL_COUNT"
echo "✅ Başarılı: $SUCCESS_COUNT"
echo "❌ Başarısız: $FAIL_COUNT"
echo ""
echo "═══════════════════════════════════════════════════════"

# Başarısız test varsa exit code 1 döndür
if [ $FAIL_COUNT -gt 0 ]; then
  exit 1
fi

exit 0

