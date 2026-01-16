#!/bin/bash

# Event Feed Cache Test Script
# Event post oluşturulduktan sonra cache'in doğru temizlendiğini test eder

# Renk kodları
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
BASE_URL="http://localhost:3000/api/v1"
TOKEN="your-auth-token-here"
EVENT_ID="00MKFPNIQ30000064YDGL62K7Q"
INVENTORY_ID="c505c6c2-1234-5678-90ab-cdef12345678"

echo -e "${YELLOW}================================${NC}"
echo -e "${YELLOW}Event Feed Cache Invalidation Test${NC}"
echo -e "${YELLOW}================================${NC}\n"

# Test 1: Event posts'u çek (cache'e kaydedilecek)
echo -e "${YELLOW}[Test 1] Fetching event posts (will be cached)...${NC}"
RESPONSE=$(curl -s -X GET \
  -H "Authorization: Bearer ${TOKEN}" \
  "${BASE_URL}/events/${EVENT_ID}/posts")

POST_COUNT_BEFORE=$(echo $RESPONSE | jq '.posts | length')
echo -e "${GREEN}✓ Posts fetched (count: ${POST_COUNT_BEFORE})${NC}\n"

# Test 2: Yeni post oluştur
echo -e "${YELLOW}[Test 2] Creating new event post...${NC}"
POST_RESPONSE=$(curl -s -X POST \
  -H "Authorization: Bearer ${TOKEN}" \
  -F "body=Cache invalidation test - $(date +%s)" \
  -F "inventoryId=${INVENTORY_ID}" \
  "${BASE_URL}/posts/${EVENT_ID}/post")

POST_ID=$(echo $POST_RESPONSE | jq -r '.id')
if [ "$POST_ID" != "null" ]; then
  echo -e "${GREEN}✓ Post created: ${POST_ID}${NC}\n"
else
  echo -e "${RED}✗ Failed to create post${NC}"
  echo $POST_RESPONSE | jq '.'
  exit 1
fi

# Test 3: Event posts'u tekrar çek (cache temizlenmişse yeni post görünmeli)
echo -e "${YELLOW}[Test 3] Fetching event posts again (should show new post)...${NC}"
sleep 1 # Kısa bekleme

NEW_RESPONSE=$(curl -s -X GET \
  -H "Authorization: Bearer ${TOKEN}" \
  "${BASE_URL}/events/${EVENT_ID}/posts")

POST_COUNT_AFTER=$(echo $NEW_RESPONSE | jq '.posts | length')
NEW_POST_VISIBLE=$(echo $NEW_RESPONSE | jq --arg id "$POST_ID" '.posts[] | select(.id == $id) | .id')

echo -e "Post count before: ${POST_COUNT_BEFORE}"
echo -e "Post count after: ${POST_COUNT_AFTER}"

if [ "$NEW_POST_VISIBLE" != "" ]; then
  echo -e "${GREEN}✓ New post is visible in feed (cache invalidated successfully!)${NC}\n"
else
  echo -e "${RED}✗ New post NOT visible in feed (cache invalidation failed!)${NC}\n"
  exit 1
fi

# Test 4: Event detail'i çek (cache temizlenmişse güncel data gelmeli)
echo -e "${YELLOW}[Test 4] Fetching event detail...${NC}"
EVENT_DETAIL=$(curl -s -X GET \
  -H "Authorization: Bearer ${TOKEN}" \
  "${BASE_URL}/events/${EVENT_ID}")

echo $EVENT_DETAIL | jq '.title, .totalPosts, .totalParticipants'
echo -e "${GREEN}✓ Event detail fetched${NC}\n"

# Test 5: Sayfa 2'yi çek (cursor cache'i test)
echo -e "${YELLOW}[Test 5] Testing cursor-based pagination...${NC}"
FIRST_PAGE=$(curl -s -X GET \
  -H "Authorization: Bearer ${TOKEN}" \
  "${BASE_URL}/events/${EVENT_ID}/posts?limit=5")

NEXT_CURSOR=$(echo $FIRST_PAGE | jq -r '.nextCursor')
echo -e "First page cursor: ${NEXT_CURSOR}"

if [ "$NEXT_CURSOR" != "null" ] && [ "$NEXT_CURSOR" != "" ]; then
  SECOND_PAGE=$(curl -s -X GET \
    -H "Authorization: Bearer ${TOKEN}" \
    "${BASE_URL}/events/${EVENT_ID}/posts?cursor=${NEXT_CURSOR}&limit=5")
  
  SECOND_PAGE_COUNT=$(echo $SECOND_PAGE | jq '.posts | length')
  echo -e "${GREEN}✓ Second page fetched (count: ${SECOND_PAGE_COUNT})${NC}\n"
else
  echo -e "${YELLOW}⚠ No cursor available (not enough posts)${NC}\n"
fi

echo -e "${GREEN}================================${NC}"
echo -e "${GREEN}All tests passed! ✓${NC}"
echo -e "${GREEN}Cache invalidation working correctly${NC}"
echo -e "${GREEN}================================${NC}"
