#!/bin/bash

# Event Post Endpoint Test Script
# Bu script POST /posts/{eventId}/post endpoint'ini test eder

# Renkli çıktı için
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# API URL
API_URL="http://localhost:3000/api/v1"

# Test değişkenleri (Bu değerleri kendi ortamınıza göre değiştirin)
TOKEN="your-auth-token-here"
EVENT_ID="00MKFPNIQ30000064YDGL62K7Q"
PRODUCT_ID="ef64a017-3801-4276-b4b7-cfb71bd1f7fa"

echo -e "${YELLOW}=== Event Post Endpoint Test ===${NC}\n"

# Test 1: Body field ile post oluşturma
echo -e "${YELLOW}Test 1: Body field ile text-only post oluşturma${NC}"
curl -X POST \
  -H "Authorization: Bearer ${TOKEN}" \
  -F "body=Event için içerik. Bu çok güzel bir ürün!" \
  -F "contextType=product" \
  -F "contextId=${PRODUCT_ID}" \
  "${API_URL}/posts/${EVENT_ID}/post"
echo -e "\n"

# Test 2: Maksimum karakter sayısı kontrolü (2000 chars)
echo -e "${YELLOW}Test 2: 2000 karakterden fazla body (hata bekleniyor)${NC}"
LONG_TEXT=$(printf 'A%.0s' {1..2001})
curl -X POST \
  -H "Authorization: Bearer ${TOKEN}" \
  -F "body=${LONG_TEXT}" \
  -F "contextType=product" \
  -F "contextId=${PRODUCT_ID}" \
  "${API_URL}/posts/${EVENT_ID}/post"
echo -e "\n"

# Test 3: Eksik body field (hata bekleniyor)
echo -e "${YELLOW}Test 3: Eksik body field (hata bekleniyor)${NC}"
curl -X POST \
  -H "Authorization: Bearer ${TOKEN}" \
  -F "contextType=product" \
  -F "contextId=${PRODUCT_ID}" \
  "${API_URL}/posts/${EVENT_ID}/post"
echo -e "\n"

# Test 4: Geçersiz contextType (hata bekleniyor)
echo -e "${YELLOW}Test 4: Geçersiz contextType (hata bekleniyor)${NC}"
curl -X POST \
  -H "Authorization: Bearer ${TOKEN}" \
  -F "body=Test içerik" \
  -F "contextType=invalid_type" \
  -F "contextId=${PRODUCT_ID}" \
  "${API_URL}/posts/${EVENT_ID}/post"
echo -e "\n"

# Test 5: Sub-category context ile post
echo -e "${YELLOW}Test 5: Sub-category context ile post oluşturma${NC}"
SUB_CATEGORY_ID="01H8EXAMPLE123456789ABCD"  # Değiştirin
curl -X POST \
  -H "Authorization: Bearer ${TOKEN}" \
  -F "body=Bu kategorideki ürünler harika!" \
  -F "contextType=sub_category" \
  -F "contextId=${SUB_CATEGORY_ID}" \
  "${API_URL}/posts/${EVENT_ID}/post"
echo -e "\n"

# Test 6: Event'e katılmamış kullanıcı (403 NOT_JOINED bekleniyor)
echo -e "${YELLOW}Test 6: Event'e katılmamış kullanıcı (403 bekleniyor)${NC}"
# Bu test için farklı bir token kullanın veya event'ten leave olun
echo -e "${RED}Bu testi manuel olarak test edin (farklı kullanıcı token'ı gerekiyor)${NC}\n"

# Test 7: Geçersiz Event ID (404 bekleniyor)
echo -e "${YELLOW}Test 7: Geçersiz Event ID (404 bekleniyor)${NC}"
curl -X POST \
  -H "Authorization: Bearer ${TOKEN}" \
  -F "body=Test içerik" \
  -F "contextType=product" \
  -F "contextId=${PRODUCT_ID}" \
  "${API_URL}/posts/INVALID_EVENT_ID/post"
echo -e "\n"

# Test 8: Geçersiz Product ID (404 bekleniyor)
echo -e "${YELLOW}Test 8: Geçersiz Product ID (404 bekleniyor)${NC}"
curl -X POST \
  -H "Authorization: Bearer ${TOKEN}" \
  -F "body=Test içerik" \
  -F "contextType=product" \
  -F "contextId=invalid-product-id" \
  "${API_URL}/posts/${EVENT_ID}/post"
echo -e "\n"

echo -e "${GREEN}=== Test Tamamlandı ===${NC}"
echo -e "${YELLOW}Not: Token, Event ID ve Product ID değerlerini güncelleyin${NC}"
echo -e "${YELLOW}Not: Image upload testleri için image dosyaları ekleyin${NC}"
