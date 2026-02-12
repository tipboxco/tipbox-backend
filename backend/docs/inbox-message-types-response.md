# Inbox / Thread Mesaj Tipleri – JSON Response

GET `/inbox/:threadId` cevabında `items` dizisi `MessageFeedItem[]` döner. Her item:

```ts
{ id: string; type: MessageType; data: Message | SupportRequest | TipsInfo }
```

`MessageType`: `"message"` | `"image"` | `"shared_post"` | `"send-tips"` | `"support-request"`

---

## 1. `type: "message"` (normal metin)

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440001",
  "type": "message",
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440001",
    "senderId": "480f5de9-b691-4d70-a6a8-2789226f4e07",
    "message": "Merhaba, nasılsın?",
    "timestamp": "2026-02-11T10:30:00.000Z",
    "isUnread": false
  }
}
```

---

## 2. `type: "image"` (görsel mesaj)

```json
{
  "id": "660e8400-e29b-41d4-a716-446655440002",
  "type": "image",
  "data": {
    "id": "660e8400-e29b-41d4-a716-446655440002",
    "senderId": "480f5de9-b691-4d70-a6a8-2789226f4e07",
    "message": "Fotoğraf altı yazısı (opsiyonel)",
    "timestamp": "2026-02-11T10:35:00.000Z",
    "isUnread": false,
    "mediaUrl": "http://localhost:9000/tipbox-media/...",
    "thumbnailUrl": "http://localhost:9000/tipbox-media/...",
    "caption": "Fotoğraf altı yazısı (opsiyonel)"
  }
}
```

---

## 3. `type: "shared_post"` (paylaşılan post)

```json
{
  "id": "770e8400-e29b-41d4-a716-446655440003",
  "type": "shared_post",
  "data": {
    "id": "770e8400-e29b-41d4-a716-446655440003",
    "senderId": "480f5de9-b691-4d70-a6a8-2789226f4e07",
    "message": "Bu ürünü beğenebilirsin",
    "sharedPostId": "01JKP1234567890ABCDEFG",
    "sharedPost": {
      "postId": "01JKP1234567890ABCDEFG",
      "postType": "UPDATE",
      "authorName": "Ahmet Yılmaz",
      "authorTitle": "Product Expert",
      "authorAvatar": "http://localhost:9000/tipbox-media/..."
    },
    "timestamp": "2026-02-11T10:46:26.579Z",
    "isUnread": false
  }
}
```

`postType`: `"QUESTION"` | `"UPDATE"` | `"EXPERIENCE"` | `"COMPARE"` | `"TIPS"` | `"FREE"`

---

## 4. `type: "send-tips"` (TIPS transferi)

```json
{
  "id": "880e8400-e29b-41d4-a716-446655440004",
  "type": "send-tips",
  "data": {
    "id": "880e8400-e29b-41d4-a716-446655440004",
    "senderId": "480f5de9-b691-4d70-a6a8-2789226f4e07",
    "amount": 100.5,
    "message": "Teşekkürler! (opsiyonel)",
    "timestamp": "2026-02-11T11:00:00.000Z",
    "isUnread": false
  }
}
```

---

## 5. `type: "support-request"` (destek talebi)

```json
{
  "id": "990e8400-e29b-41d4-a716-446655440005",
  "type": "support-request",
  "data": {
    "id": "990e8400-e29b-41d4-a716-446655440005",
    "senderId": "480f5de9-b691-4d70-a6a8-2789226f4e07",
    "type": "TECHNICAL",
    "message": "Smartwatch kurulumu için yardım",
    "amount": 50,
    "status": "accepted",
    "timestamp": "2026-02-11T09:00:00.000Z",
    "threadId": "aa0e8400-e29b-41d4-a716-446655440000",
    "requestId": "990e8400-e29b-41d4-a716-446655440005",
    "fromUserId": "480f5de9-b691-4d70-a6a8-2789226f4e07",
    "toUserId": "660e8400-e29b-41d4-a716-446655440001",
    "isUnread": false
  }
}
```

- `type` (support tipi): `"GENERAL"` | `"TECHNICAL"` | `"PRODUCT"`
- `status`: `"pending"` | `"accepted"` | `"rejected"` | `"canceled"` | `"awaiting_completion"` | `"completed"` | `"reported"`

---

## Özet tablo

| type             | data tipi       | Öne çıkan alanlar |
|------------------|-----------------|----------------------------------------|
| `message`        | Message         | `message`                              |
| `image`          | Message         | `mediaUrl`, `thumbnailUrl`, `caption`  |
| `shared_post`    | Message         | `sharedPostId`, `sharedPost` (postType, authorName, authorTitle, authorAvatar) |
| `send-tips`      | TipsInfo        | `amount`, `message`                    |
| `support-request`| SupportRequest  | `type`, `message`, `amount`, `status`, `threadId` |

Tüm mesaj tiplerinde `data` içinde `senderId` vardır; gönderen bilgisi (isim, avatar) ayrıca dönen `participants` objesinden `senderId` ile eşleştirilerek alınır.
