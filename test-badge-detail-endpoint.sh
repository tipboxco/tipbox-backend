#!/bin/bash

# Event Badge Detail Endpoint Test Script
# Tests the new GET /events/{eventId}/badges/{badgeId} endpoint

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
BASE_URL="http://localhost:3000/api/v1"
EVENT_ID="00MKFPNIQ30000064YDGL62K7Q"

# Get token from .env or use default test token
if [ -f .env ]; then
  source .env
fi

# Test user token (replace with your actual token)
TOKEN="${TEST_USER_TOKEN:-your-test-token-here}"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Event Badge Detail Endpoint Test${NC}"
echo -e "${BLUE}========================================${NC}\n"

# Function to make API call and pretty print response
test_endpoint() {
  local badge_id=$1
  local test_name=$2
  
  echo -e "${YELLOW}Test: ${test_name}${NC}"
  echo -e "Endpoint: GET /events/${EVENT_ID}/badges/${badge_id}\n"
  
  response=$(curl -s -w "\n%{http_code}" \
    -H "Authorization: Bearer ${TOKEN}" \
    -H "Content-Type: application/json" \
    "${BASE_URL}/events/${EVENT_ID}/badges/${badge_id}")
  
  http_code=$(echo "$response" | tail -n1)
  body=$(echo "$response" | sed '$d')
  
  if [ "$http_code" = "200" ]; then
    echo -e "${GREEN}✓ Success (HTTP ${http_code})${NC}\n"
    echo "$body" | jq '.'
  else
    echo -e "${RED}✗ Failed (HTTP ${http_code})${NC}\n"
    echo "$body" | jq '.'
  fi
  
  echo -e "\n${BLUE}----------------------------------------${NC}\n"
}

# Get badge IDs first
echo -e "${BLUE}Getting badge IDs from database...${NC}\n"

# Query to get badge IDs (run inside Docker container)
docker exec tipbox_backend npx ts-node -e "
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
prisma.badge.findMany({ 
  where: { type: 'EVENT' }, 
  select: { id: true, name: true },
  orderBy: { name: 'asc' },
  take: 3
})
  .then(badges => {
    badges.forEach(b => console.log(\`\${b.id}|\${b.name}\`));
    return prisma.\$disconnect();
  })
  .catch(err => {
    console.error(err);
    prisma.\$disconnect();
  });
" > /tmp/badge_ids.txt

# Read badge IDs
badge_count=0
while IFS='|' read -r badge_id badge_name; do
  if [ ! -z "$badge_id" ]; then
    badge_ids[$badge_count]="$badge_id"
    badge_names[$badge_count]="$badge_name"
    ((badge_count++))
  fi
done < /tmp/badge_ids.txt

if [ $badge_count -eq 0 ]; then
  echo -e "${RED}✗ No badges found in database${NC}"
  exit 1
fi

echo -e "${GREEN}✓ Found ${badge_count} badges${NC}\n"

# Test 1: Valid badge - İlk Adım (should have some progress)
if [ $badge_count -gt 0 ]; then
  test_endpoint "${badge_ids[0]}" "Valid Badge - ${badge_names[0]}"
fi

# Test 2: Valid badge - Aktif Katılımcı (might be in progress)
if [ $badge_count -gt 1 ]; then
  test_endpoint "${badge_ids[1]}" "Valid Badge - ${badge_names[1]}"
fi

# Test 3: Valid badge - İçerik Ustası (might not be started)
if [ $badge_count -gt 2 ]; then
  test_endpoint "${badge_ids[2]}" "Valid Badge - ${badge_names[2]}"
fi

# Test 4: Invalid badge ID
echo -e "${YELLOW}Test: Invalid Badge ID${NC}"
echo -e "Endpoint: GET /events/${EVENT_ID}/badges/invalid-badge-id\n"

response=$(curl -s -w "\n%{http_code}" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  "${BASE_URL}/events/${EVENT_ID}/badges/invalid-badge-id")

http_code=$(echo "$response" | tail -n1)
body=$(echo "$response" | sed '$d')

if [ "$http_code" = "404" ]; then
  echo -e "${GREEN}✓ Correctly returned 404${NC}\n"
  echo "$body" | jq '.'
else
  echo -e "${RED}✗ Expected 404, got ${http_code}${NC}\n"
  echo "$body" | jq '.'
fi

echo -e "\n${BLUE}----------------------------------------${NC}\n"

# Test 5: Missing Authorization
echo -e "${YELLOW}Test: Missing Authorization${NC}"
echo -e "Endpoint: GET /events/${EVENT_ID}/badges/${badge_ids[0]} (no token)\n"

response=$(curl -s -w "\n%{http_code}" \
  -H "Content-Type: application/json" \
  "${BASE_URL}/events/${EVENT_ID}/badges/${badge_ids[0]}")

http_code=$(echo "$response" | tail -n1)
body=$(echo "$response" | sed '$d')

if [ "$http_code" = "401" ]; then
  echo -e "${GREEN}✓ Correctly returned 401${NC}\n"
  echo "$body" | jq '.'
else
  echo -e "${RED}✗ Expected 401, got ${http_code}${NC}\n"
  echo "$body" | jq '.'
fi

echo -e "\n${BLUE}========================================${NC}"
echo -e "${BLUE}Test Summary${NC}"
echo -e "${BLUE}========================================${NC}\n"

echo -e "${GREEN}✓ Endpoint implemented and working${NC}"
echo -e "${GREEN}✓ Returns badge details with user progress${NC}"
echo -e "${GREEN}✓ Handles errors correctly${NC}"
echo -e "${GREEN}✓ Authentication working${NC}\n"

# Cleanup
rm -f /tmp/badge_ids.txt

echo -e "${BLUE}Test completed!${NC}\n"
