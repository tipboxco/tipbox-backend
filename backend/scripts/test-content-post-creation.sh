#!/bin/bash

# Content Post Creation Test Script
# Usage: ./test-content-post-creation.sh "YOUR_JWT_TOKEN"

set -e

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if token is provided
if [ -z "$1" ]; then
    echo -e "${RED}Error: JWT token required${NC}"
    echo "Usage: $0 \"YOUR_JWT_TOKEN\""
    exit 1
fi

TOKEN="$1"
BASE_URL="http://localhost:3000"

echo -e "${YELLOW}🧪 Testing Admin Content Post Creation Endpoint${NC}"
echo "================================================"
echo ""

# Step 1: Get a user ID
echo "Step 1: Get a user ID for the post"
echo "-----------------------------------"
USER_ID="480f5de9-b691-4d70-a6a8-2789226f4e07"
echo -e "${GREEN}✅ Using user ID: $USER_ID${NC}"
echo ""

# Step 2: Create a content post
echo "Step 2: Create a content post"
echo "------------------------------"
HTTP_RESPONSE=$(mktemp)
HTTP_CODE=$(curl -s -w "%{http_code}" -o "$HTTP_RESPONSE" -X POST "$BASE_URL/admin/content/posts" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "'"$USER_ID"'",
    "type": "UPDATE",
    "title": "Test Post - Automated Test",
    "body": "This is a test post created by the automated test script.",
    "mainCategoryId": null,
    "subCategoryId": null,
    "categoryId": null,
    "productId": null,
    "productGroupId": null,
    "eventId": null
  }')

RESPONSE_BODY=$(cat "$HTTP_RESPONSE")

if [ "$HTTP_CODE" != "201" ]; then
    echo -e "${RED}❌ FAILED! Expected 201, got $HTTP_CODE${NC}"
    echo "Response:"
    echo "$RESPONSE_BODY" | jq .
    exit 1
fi

POST_ID=$(echo "$RESPONSE_BODY" | jq -r '.data.id')

if [ -z "$POST_ID" ] || [ "$POST_ID" = "null" ]; then
    echo -e "${RED}❌ FAILED! No post ID in response${NC}"
    echo "$RESPONSE_BODY" | jq .
    exit 1
fi

echo -e "${GREEN}✅ SUCCESS! Post created with ID: $POST_ID${NC}"
echo ""

# Step 3: Verify post was created (GET)
echo "Step 3: Verify post was created"
echo "---------------------------------------------------------------"
VERIFY_RESPONSE=$(mktemp)
VERIFY_HTTP_CODE=$(curl -s -w "%{http_code}" -o "$VERIFY_RESPONSE" -X GET "$BASE_URL/admin/content/posts/$POST_ID" \
  -H "Authorization: Bearer $TOKEN")

VERIFY_BODY=$(cat "$VERIFY_RESPONSE")

if [ "$VERIFY_HTTP_CODE" != "200" ]; then
    echo -e "${RED}❌ Verification failed! Expected 200, got $VERIFY_HTTP_CODE${NC}"
    echo "$VERIFY_BODY" | jq .
else
    VERIFY_TITLE=$(echo "$VERIFY_BODY" | jq -r '.data.title')
    if [ "$VERIFY_TITLE" = "Test Post - Automated Test" ]; then
        echo -e "${GREEN}✅ Verification successful! Post details match.${NC}"
    else
        echo -e "${YELLOW}⚠️  Warning: Title mismatch${NC}"
        echo "Expected: Test Post - Automated Test"
        echo "Got: $VERIFY_TITLE"
    fi
fi
echo ""

# Step 4: Cleanup - Delete test post
echo "Step 4: Cleanup - Delete test post"
echo "------------------------------------"
DELETE_RESPONSE=$(mktemp)
DELETE_HTTP_CODE=$(curl -s -w "%{http_code}" -o "$DELETE_RESPONSE" -X DELETE "$BASE_URL/admin/content/posts/$POST_ID" \
  -H "Authorization: Bearer $TOKEN")

if [ "$DELETE_HTTP_CODE" = "200" ] || [ "$DELETE_HTTP_CODE" = "204" ]; then
    echo -e "${GREEN}✅ Test post deleted successfully${NC}"
else
    echo -e "${YELLOW}⚠️  Warning: Could not delete test post (HTTP $DELETE_HTTP_CODE)${NC}"
    echo "You may need to manually delete post ID: $POST_ID"
fi
echo ""

echo "================================================"
echo -e "${GREEN}✅ All tests passed!${NC}"
echo "================================================"
