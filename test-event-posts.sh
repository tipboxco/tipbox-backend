#!/bin/bash

# API Test Script for EventPost Implementation
# Test all endpoints: active events, upcoming events, my-events, event posts

BASE_URL="http://localhost:3000"
TOKEN="" # Will be filled after login

echo "=========================================="
echo "EventPost API Test Script"
echo "=========================================="
echo ""

# 1. Login
echo "1. Testing login..."
LOGIN_RESPONSE=$(curl -s -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user1@example.com",
    "password": "password123"
  }')

TOKEN=$(echo $LOGIN_RESPONSE | jq -r '.accessToken // .token // empty')

if [ -z "$TOKEN" ]; then
  echo "❌ Login failed"
  echo "Response: $LOGIN_RESPONSE"
  exit 1
fi

echo "✅ Login successful"
echo "Token: ${TOKEN:0:20}..."
echo ""

# 2. Get Active Events
echo "2. Testing GET /events/active..."
ACTIVE_EVENTS=$(curl -s -X GET "$BASE_URL/events/active?limit=5" \
  -H "Authorization: Bearer $TOKEN")

ACTIVE_COUNT=$(echo $ACTIVE_EVENTS | jq '.items | length')
echo "✅ Active events: $ACTIVE_COUNT"
echo "Response: $(echo $ACTIVE_EVENTS | jq -c '.items[0] // {}')"
echo ""

# 3. Get Upcoming Events
echo "3. Testing GET /events/upcoming..."
UPCOMING_EVENTS=$(curl -s -X GET "$BASE_URL/events/upcoming?limit=5" \
  -H "Authorization: Bearer $TOKEN")

UPCOMING_COUNT=$(echo $UPCOMING_EVENTS | jq '.items | length')
echo "✅ Upcoming events: $UPCOMING_COUNT"
echo "Response: $(echo $UPCOMING_EVENTS | jq -c '.items[0] // {}')"
echo ""

# 4. Get My Events
echo "4. Testing GET /events/my-events..."
MY_EVENTS=$(curl -s -X GET "$BASE_URL/events/my-events?limit=5" \
  -H "Authorization: Bearer $TOKEN")

MY_COUNT=$(echo $MY_EVENTS | jq '.items | length')
echo "✅ My events: $MY_COUNT"
echo "Response: $(echo $MY_EVENTS | jq -c '.items[0] // {}')"
echo ""

# 5. Get First Event ID
if [ "$ACTIVE_COUNT" -gt 0 ]; then
  EVENT_ID=$(echo $ACTIVE_EVENTS | jq -r '.items[0].eventId')
  
  echo "5. Testing GET /events/$EVENT_ID/posts..."
  EVENT_POSTS=$(curl -s -X GET "$BASE_URL/events/$EVENT_ID/posts?limit=10" \
    -H "Authorization: Bearer $TOKEN")
  
  POST_COUNT=$(echo $EVENT_POSTS | jq '.items | length')
  echo "✅ Event posts: $POST_COUNT"
  echo "Response: $(echo $EVENT_POSTS | jq -c '.items[0] // {}')"
  echo ""
  
  # 6. Create a new event post
  echo "6. Testing POST /events/$EVENT_ID/posts..."
  NEW_POST=$(curl -s -X POST "$BASE_URL/events/$EVENT_ID/posts" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d '{
      "title": "Test Event Post",
      "body": "Bu bir test event post'u. API çalışıyor!"
    }')
  
  NEW_POST_ID=$(echo $NEW_POST | jq -r '.id // empty')
  
  if [ -z "$NEW_POST_ID" ]; then
    echo "❌ Create post failed"
    echo "Response: $NEW_POST"
  else
    echo "✅ Post created: $NEW_POST_ID"
    echo ""
    
    # 7. Like the post
    echo "7. Testing POST /events/$EVENT_ID/posts/$NEW_POST_ID/like..."
    LIKE_RESPONSE=$(curl -s -X POST "$BASE_URL/events/$EVENT_ID/posts/$NEW_POST_ID/like" \
      -H "Authorization: Bearer $TOKEN")
    
    echo "✅ Like toggled: $(echo $LIKE_RESPONSE | jq -c '.')"
    echo ""
    
    # 8. Add comment
    echo "8. Testing POST /events/$EVENT_ID/posts/$NEW_POST_ID/comments..."
    COMMENT_RESPONSE=$(curl -s -X POST "$BASE_URL/events/$EVENT_ID/posts/$NEW_POST_ID/comments" \
      -H "Authorization: Bearer $TOKEN" \
      -H "Content-Type: application/json" \
      -d '{
        "comment": "Harika bir paylaşım!"
      }')
    
    COMMENT_ID=$(echo $COMMENT_RESPONSE | jq -r '.id // empty')
    echo "✅ Comment added: $COMMENT_ID"
    echo ""
    
    # 9. Get comments
    echo "9. Testing GET /events/$EVENT_ID/posts/$NEW_POST_ID/comments..."
    COMMENTS=$(curl -s -X GET "$BASE_URL/events/$EVENT_ID/posts/$NEW_POST_ID/comments" \
      -H "Authorization: Bearer $TOKEN")
    
    COMMENT_COUNT=$(echo $COMMENTS | jq '.items | length')
    echo "✅ Comments: $COMMENT_COUNT"
    echo ""
    
    # 10. Delete the post
    echo "10. Testing DELETE /events/$EVENT_ID/posts/$NEW_POST_ID..."
    DELETE_RESPONSE=$(curl -s -X DELETE "$BASE_URL/events/$EVENT_ID/posts/$NEW_POST_ID" \
      -H "Authorization: Bearer $TOKEN" \
      -w "\nHTTP_STATUS:%{http_code}")
    
    HTTP_STATUS=$(echo "$DELETE_RESPONSE" | grep "HTTP_STATUS" | cut -d: -f2)
    
    if [ "$HTTP_STATUS" = "204" ]; then
      echo "✅ Post deleted successfully"
    else
      echo "❌ Delete failed: HTTP $HTTP_STATUS"
    fi
  fi
else
  echo "⚠️ No active events found, skipping post tests"
fi

echo ""
echo "=========================================="
echo "✅ All tests completed!"
echo "=========================================="

