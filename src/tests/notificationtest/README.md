# Notification Test Scripts

Comprehensive test scripts for all notification types in the Tipbox backend. Each script creates real test data, triggers notifications through actual service methods, verifies the results, and cleans up afterward.

## Directory Structure

```
src/tests/notificationtest/
├── helpers/
│   ├── test-data-creator.ts      # Utilities for creating test data
│   ├── test-data-cleaner.ts      # Utilities for cleaning test data
│   └── media-helper.ts            # MinIO media path utilities
├── notification.post.test.ts      # POST_LIKED, POST_COMMENTED, POST_SHARED, POST_FAVORITED
├── notification.comment.test.ts   # COMMENT_LIKED, COMMENT_REPLIED
├── notification.trust.test.ts     # NEW_TRUSTER, NEW_TRUSTED_BY
├── notification.message.test.ts   # NEW_MESSAGE, DM_REQUEST_RECEIVED, DM_REQUEST_ACCEPTED, SUPPORT_REQUEST_ACCEPTED
├── notification.gamification.test.ts  # NEW_BADGE, ACHIEVEMENT_UNLOCKED, LEVEL_UP, REWARD_EARNED
├── notification.expert.test.ts    # EXPERT_REQUEST_AVAILABLE, EXPERT_REQUEST_ANSWERED
├── notification.collection.test.ts # COLLECTION_POST_ADDED, COLLECTION_SHARED
├── notification.event.test.ts     # EVENT_STARTED, EVENT_ENDING_SOON, EVENT_REWARD_AVAILABLE
├── notification.system.test.ts    # SYSTEM_ANNOUNCEMENT, ACCOUNT_SECURITY, TIPS_RECEIVED, TIPS_SENT
└── README.md                      # This file
```

## Prerequisites

1. **Environment Setup**: Ensure `SEED_MEDIA_BASE_URL` is set in your `.env` file:
   ```bash
   # Development
   SEED_MEDIA_BASE_URL=http://192.168.1.195:9000
   
   # Test
   SEED_MEDIA_BASE_URL=http://api-test.tipbox.co:9000
   
   # Production
   SEED_MEDIA_BASE_URL=<production-minio-endpoint>
   ```

2. **Database**: Ensure database is running and accessible

3. **Redis & Queue**: Redis should be running (optional, tests will continue without it)

4. **MinIO**: MinIO should be running and accessible at `SEED_MEDIA_BASE_URL`

## Running Tests

### Run Individual Test Script

```bash
# Post notifications
docker-compose exec backend npx ts-node src/tests/notificationtest/notification.post.test.ts

# Trust notifications
docker-compose exec backend npx ts-node src/tests/notificationtest/notification.trust.test.ts

# Message notifications
docker-compose exec backend npx ts-node src/tests/notificationtest/notification.message.test.ts

# Gamification notifications
docker-compose exec backend npx ts-node src/tests/notificationtest/notification.gamification.test.ts

# Expert notifications
docker-compose exec backend npx ts-node src/tests/notificationtest/notification.expert.test.ts

# Collection notifications
docker-compose exec backend npx ts-node src/tests/notificationtest/notification.collection.test.ts

# Event notifications
docker-compose exec backend npx ts-node src/tests/notificationtest/notification.event.test.ts

# System notifications
docker-compose exec backend npx ts-node src/tests/notificationtest/notification.system.test.ts

# Comment notifications
docker-compose exec backend npx ts-node src/tests/notificationtest/notification.comment.test.ts
```

### Run All Tests (Bash Script)

Create a script to run all tests:

```bash
#!/bin/bash
for test in src/tests/notificationtest/notification.*.test.ts; do
  echo "Running $test..."
  docker-compose exec backend npx ts-node "$test"
  echo ""
done
```

## Test Flow

Each test script follows this pattern:

1. **Environment Validation**: Checks `SEED_MEDIA_BASE_URL` is set
2. **Service Initialization**: Initializes Redis, Queue, Prisma
3. **Test Data Creation**: Creates real users, posts, interactions, etc.
4. **Notification Trigger**: Calls actual service methods to trigger notifications
5. **Verification**: Checks database for created notifications
6. **Cleanup**: Removes all test data in correct order
7. **Report**: Prints summary of test results

## Test Data

- **Users**: Created with unique emails (timestamp-based) to avoid conflicts
- **Posts**: Created with test content and optional media
- **Interactions**: Created through service methods (likes, comments, shares, etc.)
- **Media**: Uses test assets from `tests/assets/` directory

## Cleanup Strategy

Test data is cleaned up in reverse dependency order:

1. Notifications
2. Interactions (likes, comments, shares, favorites)
3. Post media
4. Posts
5. DM threads and messages
6. Trust relations
7. Achievements and badges
8. Collections
9. Users (last, as they have many dependencies)

## Notification Types Tested

### Post Interactions (notification.post.test.ts)
- ✅ `POST_LIKED` - When someone likes a post
- ✅ `POST_COMMENTED` - When someone comments on a post
- ⚠️ `POST_SHARED` - When someone shares a post (if implemented)
- ⚠️ `POST_FAVORITED` - When someone favorites a post (if implemented)

### Comment Interactions (notification.comment.test.ts)
- ⚠️ `COMMENT_LIKED` - When someone likes a comment (if implemented)
- ⚠️ `COMMENT_REPLIED` - When someone replies to a comment (if implemented)

### Trust (notification.trust.test.ts)
- ✅ `NEW_TRUSTER` - When someone starts following you
- ⚠️ `NEW_TRUSTED_BY` - Alternative trust notification (if implemented)

### Messaging (notification.message.test.ts)
- ✅ `NEW_MESSAGE` - When you receive a new DM
- ⚠️ `DM_REQUEST_RECEIVED` - When you receive a DM request (if implemented)
- ⚠️ `DM_REQUEST_ACCEPTED` - When your DM request is accepted (if implemented)
- ⚠️ `SUPPORT_REQUEST_ACCEPTED` - When support request is accepted (if implemented)

### Gamification (notification.gamification.test.ts)
- ✅ `ACHIEVEMENT_UNLOCKED` - When you unlock an achievement
- ⚠️ `NEW_BADGE` - When you earn a badge (manual test)
- ⚠️ `LEVEL_UP` - When you level up (if implemented)
- ⚠️ `REWARD_EARNED` - When you earn a reward (if implemented)

### Expert (notification.expert.test.ts)
- ⚠️ `EXPERT_REQUEST_AVAILABLE` - When new expert question is available (if implemented)
- ⚠️ `EXPERT_REQUEST_ANSWERED` - When your expert question is answered (if implemented)

### Collection (notification.collection.test.ts)
- ⚠️ `COLLECTION_POST_ADDED` - When your post is added to a collection (manual test)
- ⚠️ `COLLECTION_SHARED` - When a collection is shared (manual test)

### Event (notification.event.test.ts)
- ⚠️ `EVENT_STARTED` - When an event starts (manual test)
- ⚠️ `EVENT_ENDING_SOON` - When an event is ending soon (manual test)
- ⚠️ `EVENT_REWARD_AVAILABLE` - When event reward is available (manual test)

### System (notification.system.test.ts)
- ✅ `SYSTEM_ANNOUNCEMENT` - System announcements
- ⚠️ `ACCOUNT_SECURITY` - Security alerts (manual test)
- ⚠️ `TIPS_RECEIVED` - When you receive TIPS (manual test)
- ⚠️ `TIPS_SENT` - When you send TIPS (manual test)

**Legend:**
- ✅ Fully implemented and tested
- ⚠️ Partially implemented or requires manual notification sending

## Troubleshooting

### "SEED_MEDIA_BASE_URL not set"
- Ensure `.env` file has `SEED_MEDIA_BASE_URL` set
- Check environment variable is loaded correctly

### "Notification not found"
- Check if notification service is properly initialized
- Verify Redis/Queue are running (optional but recommended)
- Check user notification preferences (should be enabled by default in test users)
- Wait longer for notification processing (increase timeout)

### "Cleanup failed"
- Check foreign key constraints
- Verify test data IDs are tracked correctly
- Run cleanup manually if needed

### "Service method not found"
- Some notification types may not be fully implemented
- Check service implementation for missing methods
- Tests will report "not implemented" status

## Best Practices

1. **Run tests individually** to isolate issues
2. **Check test output** for detailed error messages
3. **Verify database** after tests to ensure cleanup worked
4. **Run in test environment** first before production
5. **Review notification data** in database to verify correctness

## Integration with CI/CD

These tests can be integrated into CI/CD pipelines:

```yaml
# Example GitHub Actions
- name: Test Notifications
  run: |
    docker-compose exec backend npx ts-node src/tests/notificationtest/notification.post.test.ts
    docker-compose exec backend npx ts-node src/tests/notificationtest/notification.trust.test.ts
    # ... other tests
```

## Notes

- Tests create real database records (cleaned up afterward)
- Tests use actual service methods (not mocks)
- Tests verify notifications in database
- Tests are idempotent (can be run multiple times)
- Test users have unique emails to avoid conflicts
- Media paths use MinIO and respect environment configuration



