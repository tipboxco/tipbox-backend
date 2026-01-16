# Notification Response API Documentation

## Genel Yapı

Tüm notification response'ları aşağıdaki yapıyı takip eder:

```json
{
  "success": true,
  "data": [
    {
      "id": "string",
      "userId": "string",
      "type": "NotificationType",
      "avatar": "string | null",
      "title": "string",
      "message": "string",
      "data": { /* İçerik bilgileri */ },
      "read": boolean,
      "readAt": "string | null",
      "createdAt": "string",
      "updatedAt": "string"
    }
  ],
  "pagination": {
    "total": number,
    "limit": number,
    "offset": number,
    "hasMore": boolean
  }
}
```

## Önemli Notlar

- ✅ `avatar` field'ı root seviyede (kullanıcı avatar'ı)
- ✅ `imageUrl` sadece `data` objesi içinde (içerik görseli)
- ✅ Mesajlaşma bildirimlerinde `data` içinde `imageUrl` yok
- ✅ TIPS_RECEIVED bildiriminde `data` sadece `userId` ve `amount` içerir (gönderen kullanıcı ID'si ve miktar)
- ✅ NEW_BADGE bildiriminde `data` sadece `badgeId` ve `badgeName` içerir
- ❌ Root seviyede `imageUrl` yok
- ❌ `avatarUrl` field'ı yok (sadece `avatar`)
- ❌ `userName`, `productId`, `commenterId`, `sharerId` field'ları yok
- ❌ TIPS_RECEIVED'de `data` içinde `imageUrl`, `avatar`, `senderId` yok
- ❌ NEW_BADGE'de `data` içinde `imageUrl`, `avatar` yok

---

## 1. Post Etkileşimleri

### POST_LIKED

**Endpoint:** `GET /notifications?type=POST_LIKED`

```json
{
  "id": "abc123",
  "userId": "480f5de9-b691-4d70-a6a8-2789226f4e07",
  "type": "POST_LIKED",
  "avatar": "http://192.168.1.178:9000/profile-pictures/user123/avatar.png",
  "title": "Post Liked! ❤️",
  "message": "Trust User 1 liked your post",
  "data": {
    "postId": "post123",
    "likerId": "11111111-1111-4111-a111-111111111111",
    "imageUrl": "http://192.168.1.178:9000/tipbox-media/posts/post123/image1.jpg"
  },
  "read": false,
  "readAt": null,
  "createdAt": "2026-01-16T15:51:43.015Z",
  "updatedAt": "2026-01-16T15:51:43.015Z"
}
```

**Navigation:** `data.postId` ile post detay ekranına yönlendir

---

### POST_COMMENTED

**Endpoint:** `GET /notifications?type=POST_COMMENTED`

```json
{
  "id": "def456",
  "userId": "480f5de9-b691-4d70-a6a8-2789226f4e07",
  "type": "POST_COMMENTED",
  "avatar": "http://192.168.1.178:9000/profile-pictures/user456/avatar.png",
  "title": "New Comment! 💬",
  "message": "Trust User 2 commented on your post",
  "data": {
    "postId": "post456",
    "imageUrl": "http://192.168.1.178:9000/tipbox-media/posts/post456/image1.jpg"
  },
  "read": false,
  "readAt": null,
  "createdAt": "2026-01-16T15:52:10.123Z",
  "updatedAt": "2026-01-16T15:52:10.123Z"
}
```

**Navigation:** `data.postId` ile post detay ekranına yönlendir

---

### POST_SHARED

**Endpoint:** `GET /notifications?type=POST_SHARED`

```json
{
  "id": "ghi789",
  "userId": "480f5de9-b691-4d70-a6a8-2789226f4e07",
  "type": "POST_SHARED",
  "avatar": "http://192.168.1.178:9000/profile-pictures/user789/avatar.png",
  "title": "Post Shared! 🔗",
  "message": "Trust User 3 shared your post",
  "data": {
    "postId": "post789",
    "imageUrl": "http://192.168.1.178:9000/tipbox-media/posts/post789/image1.jpg"
  },
  "read": false,
  "readAt": null,
  "createdAt": "2026-01-16T15:53:20.456Z",
  "updatedAt": "2026-01-16T15:53:20.456Z"
}
```

**Navigation:** `data.postId` ile post detay ekranına yönlendir

---

### POST_FAVORITED

**Endpoint:** `GET /notifications?type=POST_FAVORITED`

```json
{
  "id": "jkl012",
  "userId": "480f5de9-b691-4d70-a6a8-2789226f4e07",
  "type": "POST_FAVORITED",
  "avatar": "http://192.168.1.178:9000/profile-pictures/user012/avatar.png",
  "title": "Added to Favorites! ⭐",
  "message": "Trust User 4 added your post to favorites",
  "data": {
    "postId": "post012",
    "userId": "44444444-4444-4444-a444-444444444444",
    "imageUrl": "http://192.168.1.178:9000/tipbox-media/posts/post012/image1.jpg"
  },
  "read": false,
  "readAt": null,
  "createdAt": "2026-01-16T15:54:30.789Z",
  "updatedAt": "2026-01-16T15:54:30.789Z"
}
```

**Navigation:** `data.postId` ile post detay ekranına yönlendir

---

## 2. Yorum Etkileşimleri

### COMMENT_LIKED

**Endpoint:** `GET /notifications?type=COMMENT_LIKED`

```json
{
  "id": "mno345",
  "userId": "480f5de9-b691-4d70-a6a8-2789226f4e07",
  "type": "COMMENT_LIKED",
  "avatar": "http://192.168.1.178:9000/profile-pictures/user345/avatar.png",
  "title": "Comment Liked! ❤️",
  "message": "Trust User 5 liked your comment",
  "data": {
    "postId": "post345",
    "commentId": "comment123",
    "likerId": "55555555-5555-4555-a555-555555555555",
    "imageUrl": "http://192.168.1.178:9000/tipbox-media/posts/post345/image1.jpg"
  },
  "read": false,
  "readAt": null,
  "createdAt": "2026-01-16T15:55:40.012Z",
  "updatedAt": "2026-01-16T15:55:40.012Z"
}
```

**Navigation:** `data.postId` ve `data.commentId` ile post detay ekranına yönlendir, yorumu highlight et

---

### COMMENT_REPLIED

**Endpoint:** `GET /notifications?type=COMMENT_REPLIED`

```json
{
  "id": "pqr678",
  "userId": "480f5de9-b691-4d70-a6a8-2789226f4e07",
  "type": "COMMENT_REPLIED",
  "avatar": "http://192.168.1.178:9000/profile-pictures/user678/avatar.png",
  "title": "New Reply! 💬",
  "message": "Trust User 6 replied to your comment",
  "data": {
    "postId": "post678",
    "commentId": "comment456",
    "replierId": "66666666-6666-4666-a666-666666666666",
    "imageUrl": "http://192.168.1.178:9000/tipbox-media/posts/post678/image1.jpg"
  },
  "read": false,
  "readAt": null,
  "createdAt": "2026-01-16T15:56:50.345Z",
  "updatedAt": "2026-01-16T15:56:50.345Z"
}
```

**Navigation:** `data.postId` ve `data.commentId` ile post detay ekranına yönlendir, yorum thread'ini göster

---

## 3. Trust & Follow

### NEW_TRUSTER

**Endpoint:** `GET /notifications?type=NEW_TRUSTER`

```json
{
  "id": "stu901",
  "userId": "480f5de9-b691-4d70-a6a8-2789226f4e07",
  "type": "NEW_TRUSTER",
  "avatar": "http://192.168.1.178:9000/profile-pictures/user901/avatar.png",
  "title": "New Follower! 👥",
  "message": "Trust User 7 started following you",
  "data": {
    "trusterId": "77777777-7777-4777-a777-777777777777",
    "imageUrl": "http://192.168.1.178:9000/tipbox-media/avatars/default/default-useravatar.png"
  },
  "read": false,
  "readAt": null,
  "createdAt": "2026-01-16T15:57:00.678Z",
  "updatedAt": "2026-01-16T15:57:00.678Z"
}
```

**Navigation:** `data.trusterId` ile kullanıcı profil ekranına yönlendir

---

### NEW_TRUSTED_BY

**Endpoint:** `GET /notifications?type=NEW_TRUSTED_BY`

```json
{
  "id": "vwx234",
  "userId": "480f5de9-b691-4d70-a6a8-2789226f4e07",
  "type": "NEW_TRUSTED_BY",
  "avatar": "http://192.168.1.178:9000/profile-pictures/user234/avatar.png",
  "title": "You're Being Trusted! 🤝",
  "message": "Trust User 8 started trusting you",
  "data": {
    "trustedId": "88888888-8888-4888-a888-888888888888",
    "imageUrl": "http://192.168.1.178:9000/tipbox-media/avatars/default/default-useravatar.png"
  },
  "read": false,
  "readAt": null,
  "createdAt": "2026-01-16T15:58:10.901Z",
  "updatedAt": "2026-01-16T15:58:10.901Z"
}
```

**Navigation:** `data.trustedId` ile kullanıcı profil ekranına yönlendir

---

## 4. Mesajlaşma Bildirimleri

### DM_REQUEST_RECEIVED

**Endpoint:** `GET /notifications?type=DM_REQUEST_RECEIVED`

```json
{
  "id": "yza567",
  "userId": "480f5de9-b691-4d70-a6a8-2789226f4e07",
  "type": "DM_REQUEST_RECEIVED",
  "avatar": "http://192.168.1.178:9000/profile-pictures/user567/avatar.png",
  "title": "New Request! 📩",
  "message": "Trust User 9 sent you a support request: \"Merhaba! Sana mesaj göndermek istiyorum.\"",
  "data": {
    "userId": "99999999-9999-4999-a999-999999999999",
    "requestId": "request123",
    "threadId": "thread456",
    "message": "Merhaba! Sana mesaj göndermek istiyorum.",
    "amount": 50
  },
  "read": false,
  "readAt": null,
  "createdAt": "2026-01-16T15:59:20.234Z",
  "updatedAt": "2026-01-16T15:59:20.234Z"
}
```

**Navigation:** `data.threadId` ile chat ekranına yönlendir (support request detayı göster)

---

### DM_REQUEST_ACCEPTED

**Endpoint:** `GET /notifications?type=DM_REQUEST_ACCEPTED`

```json
{
  "id": "bcd890",
  "userId": "480f5de9-b691-4d70-a6a8-2789226f4e07",
  "type": "DM_REQUEST_ACCEPTED",
  "avatar": "http://192.168.1.178:9000/profile-pictures/user890/avatar.png",
  "title": "Request Accepted! ✅",
  "message": "Trust User 10 accepted your request",
  "data": {
    "userId": "aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa",
    "userName": "Trust User 10",
    "threadId": "thread789"
  },
  "read": false,
  "readAt": null,
  "createdAt": "2026-01-16T16:00:30.567Z",
  "updatedAt": "2026-01-16T16:00:30.567Z"
}
```

**Not:** DM_REQUEST_ACCEPTED bildiriminde `data` objesi sadece `userId` (request'i kabul eden kullanıcı ID'si), `userName` (kullanıcı adı) ve `threadId` (chat thread ID'si) içerir. `avatar` ve `imageUrl` gibi alanlar bulunmaz.

**Navigation:** `data.threadId` ile chat ekranına yönlendir

---

### DM_REQUEST_DECLINED

**Endpoint:** `GET /notifications?type=DM_REQUEST_DECLINED`

```json
{
  "id": "efg123",
  "userId": "480f5de9-b691-4d70-a6a8-2789226f4e07",
  "type": "DM_REQUEST_DECLINED",
  "avatar": "http://192.168.1.178:9000/profile-pictures/user123/avatar.png",
  "title": "Request Declined ❌",
  "message": "Trust User 11 declined your request",
  "data": {
    "userId": "bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb"
  },
  "read": false,
  "readAt": null,
  "createdAt": "2026-01-16T16:01:40.890Z",
  "updatedAt": "2026-01-16T16:01:40.890Z"
}
```

**Navigation:** Bildirim gösterilir, özel bir ekrana yönlendirme gerekmez

---

### SUPPORT_REQUEST_ACCEPTED

**Endpoint:** `GET /notifications?type=SUPPORT_REQUEST_ACCEPTED`

```json
{
  "id": "hij456",
  "userId": "480f5de9-b691-4d70-a6a8-2789226f4e07",
  "type": "SUPPORT_REQUEST_ACCEPTED",
  "avatar": "http://192.168.1.178:9000/profile-pictures/user456/avatar.png",
  "title": "Support Request Accepted! ✅",
  "message": "Trust User 12 accepted your support request",
  "data": {
    "userId": "cccccccc-cccc-4ccc-cccc-cccccccccccc",
    "threadId": "thread012"
  },
  "read": false,
  "readAt": null,
  "createdAt": "2026-01-16T16:02:50.123Z",
  "updatedAt": "2026-01-16T16:02:50.123Z"
}
```

**Navigation:** `data.threadId` ile 1-on-1 support request thread ekranına yönlendir

---

## 5. Gamification (Badge & Achievement)

### NEW_BADGE

**Endpoint:** `GET /notifications?type=NEW_BADGE`

```json
{
  "id": "klm789",
  "userId": "480f5de9-b691-4d70-a6a8-2789226f4e07",
  "type": "NEW_BADGE",
  "avatar": "http://192.168.1.178:9000/profile-pictures/user789/avatar.png",
  "title": "New Badge Earned! 🏆",
  "message": "You earned the Trusted Voice #1 badge!",
  "data": {
    "badgeId": "badge123",
    "badgeName": "Trusted Voice #1"
  },
  "read": false,
  "readAt": null,
  "createdAt": "2026-01-16T16:03:00.456Z",
  "updatedAt": "2026-01-16T16:03:00.456Z"
}
```

**Not:** NEW_BADGE bildiriminde `data` objesi sadece `badgeId` ve `badgeName` içerir. `imageUrl` ve `avatar` gibi alanlar bulunmaz.

**Navigation:** `data.badgeId` ile badge detay ekranına yönlendir

---

### ACHIEVEMENT_UNLOCKED

**Endpoint:** `GET /notifications?type=ACHIEVEMENT_UNLOCKED`

```json
{
  "id": "nop012",
  "userId": "480f5de9-b691-4d70-a6a8-2789226f4e07",
  "type": "ACHIEVEMENT_UNLOCKED",
  "avatar": "http://192.168.1.178:9000/profile-pictures/user012/avatar.png",
  "title": "Achievement Unlocked! 🎯",
  "message": "You completed the First Post achievement!",
  "data": {
    "badgeId": "badge456",
    "achievementId": "achievement123",
    "imageUrl": "http://192.168.1.178:9000/tipbox-media/badges/brand/brandbadge2.png"
  },
  "read": false,
  "readAt": null,
  "createdAt": "2026-01-16T16:04:10.789Z",
  "updatedAt": "2026-01-16T16:04:10.789Z"
}
```

**Navigation:** `data.achievementId` veya `data.badgeId` ile achievement/badge detay ekranına yönlendir

---

### REWARD_EARNED

**Endpoint:** `GET /notifications?type=REWARD_EARNED`

```json
{
  "id": "qrs345",
  "userId": "480f5de9-b691-4d70-a6a8-2789226f4e07",
  "type": "REWARD_EARNED",
  "avatar": "http://192.168.1.178:9000/profile-pictures/user345/avatar.png",
  "title": "Reward Earned! 🎁",
  "message": "You earned 100 TIPS!",
  "data": {
    "badgeId": "badge789",
    "amount": 100,
    "imageUrl": "http://192.168.1.178:9000/tipbox-media/badges/brand/brandbadge3.png"
  },
  "read": false,
  "readAt": null,
  "createdAt": "2026-01-16T16:05:20.012Z",
  "updatedAt": "2026-01-16T16:05:20.012Z"
}
```

**Navigation:** Reward detay ekranına yönlendir veya wallet ekranını göster

---

## 6. Event Bildirimleri

### EVENT_STARTED

**Endpoint:** `GET /notifications?type=EVENT_STARTED`

```json
{
  "id": "tuv678",
  "userId": "480f5de9-b691-4d70-a6a8-2789226f4e07",
  "type": "EVENT_STARTED",
  "avatar": "http://192.168.1.178:9000/profile-pictures/user678/avatar.png",
  "title": "Event Started! 🎉",
  "message": "The Content Creator event has started!",
  "data": {
    "eventId": "event123",
    "eventName": "The Content Creator",
    "imageUrl": "http://192.168.1.178:9000/tipbox-media/events/communityevents-the-content-creator.jpg"
  },
  "read": false,
  "readAt": null,
  "createdAt": "2026-01-16T16:06:30.345Z",
  "updatedAt": "2026-01-16T16:06:30.345Z"
}
```

**Navigation:** `data.eventId` ile event detay ekranına yönlendir

---

### EVENT_ENDING_SOON

**Endpoint:** `GET /notifications?type=EVENT_ENDING_SOON`

```json
{
  "id": "wxy901",
  "userId": "480f5de9-b691-4d70-a6a8-2789226f4e07",
  "type": "EVENT_ENDING_SOON",
  "avatar": "http://192.168.1.178:9000/profile-pictures/user901/avatar.png",
  "title": "Event Ending Soon! ⏰",
  "message": "The Digital Nomad Day event is ending soon!",
  "data": {
    "eventId": "event456",
    "eventName": "The Digital Nomad Day",
    "imageUrl": "http://192.168.1.178:9000/tipbox-media/events/communityevents-the-digital-nomad-day.jpg"
  },
  "read": false,
  "readAt": null,
  "createdAt": "2026-01-16T16:07:40.678Z",
  "updatedAt": "2026-01-16T16:07:40.678Z"
}
```

**Navigation:** `data.eventId` ile event detay ekranına yönlendir

---

### EVENT_REWARD_AVAILABLE

**Endpoint:** `GET /notifications?type=EVENT_REWARD_AVAILABLE`

```json
{
  "id": "zab234",
  "userId": "480f5de9-b691-4d70-a6a8-2789226f4e07",
  "type": "EVENT_REWARD_AVAILABLE",
  "avatar": "http://192.168.1.178:9000/profile-pictures/user234/avatar.png",
  "title": "Event Reward Available! 🎁",
  "message": "A reward is available in The Gaming Night event!",
  "data": {
    "eventId": "event789",
    "eventName": "The Gaming Night",
    "imageUrl": "http://192.168.1.178:9000/tipbox-media/events/communityevents-the-gaming-night.jpg"
  },
  "read": false,
  "readAt": null,
  "createdAt": "2026-01-16T16:08:50.901Z",
  "updatedAt": "2026-01-16T16:08:50.901Z"
}
```

**Navigation:** `data.eventId` ile event detay ekranına yönlendir, reward bölümünü göster

---

## 7. Expert Bildirimleri

### EXPERT_REQUEST_AVAILABLE

**Endpoint:** `GET /notifications?type=EXPERT_REQUEST_AVAILABLE`

```json
{
  "id": "cde567",
  "userId": "480f5de9-b691-4d70-a6a8-2789226f4e07",
  "type": "EXPERT_REQUEST_AVAILABLE",
  "avatar": "http://192.168.1.178:9000/profile-pictures/user567/avatar.png",
  "title": "Expert Request Available! 💡",
  "message": "A new expert request is available",
  "data": {
    "requestId": "expert-request-123",
    "expertId": "expert-user-456",
    "tipsAmount": 200,
    "imageUrl": "http://192.168.1.178:9000/tipbox-media/products/product123.jpg"
  },
  "read": false,
  "readAt": null,
  "createdAt": "2026-01-16T16:09:00.234Z",
  "updatedAt": "2026-01-16T16:09:00.234Z"
}
```

**Navigation:** `data.requestId` ile expert request detay ekranına yönlendir

---

### EXPERT_REQUEST_ANSWERED

**Endpoint:** `GET /notifications?type=EXPERT_REQUEST_ANSWERED`

```json
{
  "id": "fgh890",
  "userId": "480f5de9-b691-4d70-a6a8-2789226f4e07",
  "type": "EXPERT_REQUEST_ANSWERED",
  "avatar": "http://192.168.1.178:9000/profile-pictures/user890/avatar.png",
  "title": "Expert Request Answered! ✅",
  "message": "Your expert request has been answered",
  "data": {
    "requestId": "expert-request-456",
    "expertId": "expert-user-789",
    "tipsAmount": 150,
    "imageUrl": "http://192.168.1.178:9000/tipbox-media/products/product456.jpg"
  },
  "read": false,
  "readAt": null,
  "createdAt": "2026-01-16T16:10:10.567Z",
  "updatedAt": "2026-01-16T16:10:10.567Z"
}
```

**Navigation:** `data.requestId` ile expert request detay ekranına yönlendir, cevabı göster

---

## 8. Collection Bildirimleri

### COLLECTION_POST_ADDED

**Endpoint:** `GET /notifications?type=COLLECTION_POST_ADDED`

```json
{
  "id": "ijk123",
  "userId": "480f5de9-b691-4d70-a6a8-2789226f4e07",
  "type": "COLLECTION_POST_ADDED",
  "avatar": "http://192.168.1.178:9000/profile-pictures/user123/avatar.png",
  "title": "Post Added to Collection! 📚",
  "message": "Your post was added to a collection",
  "data": {
    "collectionId": "collection123",
    "postId": "post789",
    "imageUrl": "http://192.168.1.178:9000/tipbox-media/posts/post789/image1.jpg"
  },
  "read": false,
  "readAt": null,
  "createdAt": "2026-01-16T16:11:20.890Z",
  "updatedAt": "2026-01-16T16:11:20.890Z"
}
```

**Navigation:** `data.collectionId` ile collection detay ekranına yönlendir

---

### COLLECTION_SHARED

**Endpoint:** `GET /notifications?type=COLLECTION_SHARED`

```json
{
  "id": "lmn456",
  "userId": "480f5de9-b691-4d70-a6a8-2789226f4e07",
  "type": "COLLECTION_SHARED",
  "avatar": "http://192.168.1.178:9000/profile-pictures/user456/avatar.png",
  "title": "Collection Shared! 🔗",
  "message": "Your collection was shared",
  "data": {
    "collectionId": "collection456",
    "postId": "post012",
    "imageUrl": "http://192.168.1.178:9000/tipbox-media/posts/post012/image1.jpg"
  },
  "read": false,
  "readAt": null,
  "createdAt": "2026-01-16T16:12:30.123Z",
  "updatedAt": "2026-01-16T16:12:30.123Z"
}
```

**Navigation:** `data.collectionId` ile collection detay ekranına yönlendir

---

## 9. Tips Bildirimleri

### TIPS_RECEIVED

**Endpoint:** `GET /notifications?type=TIPS_RECEIVED`

```json
{
  "id": "opq789",
  "userId": "480f5de9-b691-4d70-a6a8-2789226f4e07",
  "type": "TIPS_RECEIVED",
  "avatar": "http://192.168.1.178:9000/profile-pictures/user789/avatar.png",
  "title": "TIPS Received! 💰",
  "message": "You received 50 TIPS",
  "data": {
    "userId": "dddddddd-dddd-4ddd-dddd-dddddddddddd",
    "amount": 50
  },
  "read": false,
  "readAt": null,
  "createdAt": "2026-01-16T16:13:40.456Z",
  "updatedAt": "2026-01-16T16:13:40.456Z"
}
```

**Not:** TIPS_RECEIVED bildiriminde `data` objesi sadece `userId` (tips gönderen kullanıcı) ve `amount` (gönderilen miktar) içerir. `imageUrl`, `avatar`, `senderId` gibi alanlar bulunmaz.

**Navigation:** `data.userId` ile kullanıcı profil ekranına yönlendir veya wallet ekranına yönlendir

---

### TIPS_SENT

**Endpoint:** `GET /notifications?type=TIPS_SENT`

```json
{
  "id": "rst012",
  "userId": "480f5de9-b691-4d70-a6a8-2789226f4e07",
  "type": "TIPS_SENT",
  "avatar": "http://192.168.1.178:9000/profile-pictures/user012/avatar.png",
  "title": "Tips Sent! 💸",
  "message": "You sent 25 TIPS to Trust User 14",
  "data": {
    "userId": "eeeeeeee-eeee-4eee-eeee-eeeeeeeeeeee",
    "amount": 25,
    "imageUrl": "http://192.168.1.178:9000/tipbox-media/avatars/default/default-useravatar.png"
  },
  "read": false,
  "readAt": null,
  "createdAt": "2026-01-16T16:14:50.789Z",
  "updatedAt": "2026-01-16T16:14:50.789Z"
}
```

**Navigation:** Wallet ekranına yönlendir veya transaction detayını göster

---

## API Endpoints

### Get Notifications

**Endpoint:** `GET /notifications`

**Query Parameters:**
- `limit` (number, default: 20) - Sayfa başına bildirim sayısı
- `offset` (number, default: 0) - Atlanacak bildirim sayısı
- `unreadOnly` (boolean, default: false) - Sadece okunmamış bildirimler
- `type` (string) - Filtreleme:
  - `"all"` - Tüm bildirimler
  - `"tips"` - Sadece kullanıcıya gelen tips bildirimleri (TIPS_RECEIVED)
  - `"truster"` veya `"trust"` - Trust bildirimleri (NEW_TRUSTER, NEW_TRUSTED_BY)
  - `"replies"` veya `"reply"` - Yorum bildirimleri (POST_COMMENTED, COMMENT_REPLIED, COMMENT_LIKED)
  - Direkt notification type (örn: `"POST_LIKED"`)

**Response:**
```json
{
  "success": true,
  "data": [ /* Notification array */ ],
  "pagination": {
    "total": 363,
    "limit": 20,
    "offset": 0,
    "hasMore": true
  }
}
```

### Mark as Read

**Endpoint:** `PUT /notifications/:id/read`

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "notification-id",
    "read": true,
    "readAt": "2026-01-16T16:15:00.000Z"
  }
}
```

### Mark All as Read

**Endpoint:** `PUT /notifications/mark-all-read`

**Response:**
```json
{
  "success": true,
  "data": {
    "count": 10
  }
}
```

### Get Unread Count

**Endpoint:** `GET /notifications/unread-count`

**Response:**
```json
{
  "success": true,
  "data": {
    "count": 5
  }
}
```

---

## TypeScript Types

```typescript
interface NotificationResponse {
  success: boolean;
  data: EnrichedNotification[];
  pagination: PaginationInfo;
}

interface EnrichedNotification {
  id: string;
  userId: string;
  type: NotificationType;
  avatar: string | null;
  title: string;
  message: string;
  data: NotificationData;
  read: boolean;
  readAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface PaginationInfo {
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

type NotificationData = 
  | PostInteractionData
  | CommentInteractionData
  | TrustData
  | MessagingData
  | GamificationData
  | ExpertData
  | EventData
  | SystemData
  | CollectionData;

interface PostInteractionData {
  postId: string;
  likerId?: string;
  userId?: string;
  imageUrl: string | null;
}

interface CommentInteractionData {
  postId: string;
  commentId: string;
  likerId?: string;
  replierId?: string;
  imageUrl: string | null;
}

interface TrustData {
  trusterId?: string;
  trustedId?: string;
  imageUrl: string | null;
}

interface MessagingData {
  userId: string;
  requestId?: string;
  threadId?: string;
  message?: string;
  amount?: number;
}

interface GamificationData {
  badgeId?: string;
  badgeName?: string;
  achievementId?: string;
  amount?: number;
  imageUrl: string | null;
}

interface ExpertData {
  requestId: string;
  expertId?: string;
  tipsAmount?: number;
  imageUrl: string | null;
}

interface EventData {
  eventId: string;
  eventName?: string;
  imageUrl: string | null;
}

interface CollectionData {
  collectionId: string;
  postId?: string;
  imageUrl: string | null;
}

enum NotificationType {
  POST_LIKED = 'POST_LIKED',
  POST_COMMENTED = 'POST_COMMENTED',
  POST_SHARED = 'POST_SHARED',
  POST_FAVORITED = 'POST_FAVORITED',
  COMMENT_LIKED = 'COMMENT_LIKED',
  COMMENT_REPLIED = 'COMMENT_REPLIED',
  NEW_TRUSTER = 'NEW_TRUSTER',
  NEW_TRUSTED_BY = 'NEW_TRUSTED_BY',
  DM_REQUEST_RECEIVED = 'DM_REQUEST_RECEIVED',
  DM_REQUEST_ACCEPTED = 'DM_REQUEST_ACCEPTED',
  DM_REQUEST_DECLINED = 'DM_REQUEST_DECLINED',
  SUPPORT_REQUEST_ACCEPTED = 'SUPPORT_REQUEST_ACCEPTED',
  COLLECTION_POST_ADDED = 'COLLECTION_POST_ADDED',
  COLLECTION_SHARED = 'COLLECTION_SHARED',
  NEW_BADGE = 'NEW_BADGE',
  ACHIEVEMENT_UNLOCKED = 'ACHIEVEMENT_UNLOCKED',
  REWARD_EARNED = 'REWARD_EARNED',
  EXPERT_REQUEST_AVAILABLE = 'EXPERT_REQUEST_AVAILABLE',
  EXPERT_REQUEST_ANSWERED = 'EXPERT_REQUEST_ANSWERED',
  EVENT_STARTED = 'EVENT_STARTED',
  EVENT_ENDING_SOON = 'EVENT_ENDING_SOON',
  EVENT_REWARD_AVAILABLE = 'EVENT_REWARD_AVAILABLE',
  TIPS_RECEIVED = 'TIPS_RECEIVED',
  TIPS_SENT = 'TIPS_SENT',
}
```

---

## Navigation Guide

| Notification Type | Navigation Field | Destination Screen |
|-------------------|------------------|-------------------|
| POST_LIKED | `data.postId` | Post Detail |
| POST_COMMENTED | `data.postId` | Post Detail |
| POST_SHARED | `data.postId` | Post Detail |
| POST_FAVORITED | `data.postId` | Post Detail |
| COMMENT_LIKED | `data.postId` + `data.commentId` | Post Detail (highlight comment) |
| COMMENT_REPLIED | `data.postId` + `data.commentId` | Post Detail (show thread) |
| NEW_TRUSTER | `data.trusterId` | User Profile |
| NEW_TRUSTED_BY | `data.trustedId` | User Profile |
| DM_REQUEST_RECEIVED | `data.threadId` | Chat Screen (support request) |
| DM_REQUEST_ACCEPTED | `data.threadId` | Chat Screen |
| DM_REQUEST_DECLINED | - | No navigation |
| SUPPORT_REQUEST_ACCEPTED | `data.threadId` | 1-on-1 Support Request Thread |
| NEW_BADGE | `data.badgeId` | Badge Detail |
| ACHIEVEMENT_UNLOCKED | `data.achievementId` | Achievement Detail |
| REWARD_EARNED | - | Wallet/Reward Screen |
| EVENT_STARTED | `data.eventId` | Event Detail |
| EVENT_ENDING_SOON | `data.eventId` | Event Detail |
| EVENT_REWARD_AVAILABLE | `data.eventId` | Event Detail (reward section) |
| EXPERT_REQUEST_AVAILABLE | `data.requestId` | Expert Request Detail |
| EXPERT_REQUEST_ANSWERED | `data.requestId` | Expert Request Detail |
| COLLECTION_POST_ADDED | `data.collectionId` | Collection Detail |
| COLLECTION_SHARED | `data.collectionId` | Collection Detail |
| TIPS_RECEIVED | - | Wallet/Transaction Detail |
| TIPS_SENT | - | Wallet/Transaction Detail |

---

## Son Güncelleme

**Tarih:** 2026-01-16  
**Versiyon:** 1.0.0
