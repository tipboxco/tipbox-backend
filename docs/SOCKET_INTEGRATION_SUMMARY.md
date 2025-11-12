# Socket.IO Entegrasyon Özeti

Bu dokümantasyon, Tipbox backend'deki Socket.IO entegrasyonlarını ve mesajlaşma özelliklerini özetlemektedir.

## 📋 İçindekiler

1. [Mevcut Socket Altyapısı](#mevcut-socket-altyapısı)
2. [Socket Event'leri](#socket-eventleri)
3. [Endpoint ve Socket İlişkileri](#endpoint-ve-socket-ilişkileri)
4. [Socket Handler Metodları](#socket-handler-metodları)
5. [Kullanım Senaryoları](#kullanım-senaryoları)

---

## 🔧 Mevcut Socket Altyapısı

### Temel Yapılandırma

| Özellik | Durum | Açıklama |
|---------|-------|----------|
| **Socket.IO Server** | ✅ Aktif | Express server ile entegre |
| **Redis Adapter** | ✅ Aktif | Horizontal scaling desteği |
| **JWT Authentication** | ✅ Aktif | `socket.handshake.auth.token` |
| **CORS** | ✅ Yapılandırılmış | Environment variable'dan alınıyor |
| **Transport** | ✅ WebSocket + Polling | Fallback desteği |

### Otomatik Özellikler

| Özellik | Açıklama |
|---------|----------|
| **Kullanıcı Odaları** | Her kullanıcı otomatik olarak `user:{userId}` odasına katılır |
| **Connection Event** | Bağlantı kurulduğunda `connected` event'i gönderilir |
| **Disconnect Handler** | Kullanıcı ayrıldığında loglanır |
| **Heartbeat** | `ping`/`pong` mekanizması aktif |

---

## 📡 Socket Event'leri

### Outgoing Events (Backend → Frontend)

| Event | Tetikleyen | Hedef | Payload | Durum |
|-------|------------|-------|---------|-------|
| `connected` | Connection | Origin socket | `{ message, userId, userEmail }` | ✅ Mevcut |
| `new_message` | Endpoint | `user:{recipientId}`, `thread:{threadId}` | `NewMessageEvent` | ✅ Yeni |
| `message_sent` | Endpoint | `user:{senderId}` | `MessageSentEvent` | ✅ Yeni |
| `message_read` | Endpoint | `user:{senderId}`, `thread:{threadId}` | `MessageReadEvent` | ✅ Güncellendi |
| `user_typing` | Socket Event | `thread:{threadId}` (excl. origin) | `TypingEvent` | ✅ Yeni |
| `thread_joined` | Socket Event | Origin socket | `{ threadId }` | ✅ Yeni |
| `thread_left` | Socket Event | Origin socket | `{ threadId }` | ✅ Yeni |
| `thread_join_error` | Socket Event | Origin socket | `{ threadId, reason }` | ✅ Yeni |
| `pong` | Socket Event | Origin socket | - | ✅ Mevcut |

### Incoming Events (Frontend → Backend)

| Event | Payload | Açıklama | Durum |
|-------|---------|----------|-------|
| `ping` | - | Heartbeat kontrolü | ✅ Mevcut |
| `join_thread` | `threadId: string` | Thread room'una katılma | ✅ Yeni |
| `leave_thread` | `threadId: string` | Thread room'undan ayrılma | ✅ Yeni |
| `typing_start` | `{ threadId: string }` | Yazma başladı bildirimi | ✅ Yeni |
| `typing_stop` | `{ threadId: string }` | Yazma durdu bildirimi | ✅ Yeni |

---

## 🔗 Endpoint ve Socket İlişkileri

### Endpoint'lerden Tetiklenen Socket Event'leri

| Endpoint | Method | Tetiklenen Event'ler | Service Metodu | Açıklama |
|----------|--------|---------------------|----------------|----------|
| `/messages` | POST | `new_message`<br>`message_sent` | `sendDirectMessage()` | Direkt mesaj gönderildiğinde |
| `/messages/tips` | POST | `new_message`<br>`message_sent` | `sendTips()` | TIPS gönderildiğinde (messageType: 'send-tips') |
| `/messages/support-requests` | POST | `new_message` | `createSupportRequest()` | Support request oluşturulduğunda (messageType: 'support-request') |
| `/messages/:messageId/read` | POST | `message_read` | `markMessageAsRead()` | Mesaj okundu olarak işaretlendiğinde |

### Endpoint'lerden Bağımsız Socket Event'leri

| Event | Tetikleyen | Endpoint Bağımlılığı | Kullanım Senaryosu |
|-------|------------|---------------------|-------------------|
| `join_thread` | Frontend Socket | ❌ Yok | Thread sayfası açıldığında |
| `leave_thread` | Frontend Socket | ❌ Yok | Thread sayfası kapatıldığında |
| `typing_start` | Frontend Socket | ❌ Yok | Input'a yazmaya başladığında |
| `typing_stop` | Frontend Socket | ❌ Yok | Input'tan focus çıktığında veya belirli süre yazılmadığında |

---

## 🛠️ Socket Handler Metodları

### Public Metodlar

| Metod | Parametreler | Açıklama | Kullanım Yeri |
|-------|-------------|----------|---------------|
| `sendMessageToUser()` | `userId, event, payload` | Belirli kullanıcıya mesaj gönder | MessagingService, SupportRequestService |
| `sendToRoom()` | `room, event, payload` | Belirli odaya mesaj gönder | MessagingService, SupportRequestService |
| `broadcast()` | `event, payload` | Tüm client'lara yayın | Genel kullanım |
| `isUserConnected()` | `userId` | Kullanıcı bağlı mı kontrol | Genel kullanım |
| `getConnectedUsersCount()` | - | Bağlı kullanıcı sayısı | Genel kullanım |
| `getRoomUsersCount()` | `room` | Oda kullanıcı sayısı | Genel kullanım |

### Private Metodlar

| Metod | Açıklama |
|-------|----------|
| `setupAuthenticationMiddleware()` | JWT authentication middleware |
| `setupConnectionHandlers()` | Connection/disconnect event handler'ları |
| `setupThreadHandlers()` | Thread room yönetimi (join_thread, leave_thread) |
| `setupTypingHandlers()` | Typing indicators (typing_start, typing_stop) |

---

## 📊 Event Payload Yapıları

### NewMessageEvent

```typescript
{
  messageId: string;
  threadId: string;
  senderId: string;
  recipientId: string;
  message: string;
  messageType: 'message' | 'support-request' | 'send-tips';
  timestamp: string; // ISO 8601
}
```

### MessageSentEvent

```typescript
// NewMessageEvent ile aynı yapı
```

### MessageReadEvent

```typescript
{
  messageId: string;
  threadId: string;
  readBy: string;
  timestamp: string; // ISO 8601
}
```

### TypingEvent

```typescript
{
  userId: string;
  threadId: string;
  isTyping: boolean;
}
```

---

## 🎯 Kullanım Senaryoları

### Senaryo 1: Mesaj Gönderme

1. **Frontend:** `POST /messages` endpoint'ine istek gönderir
2. **Backend:** `sendDirectMessage()` çağrılır
3. **Backend:** Mesaj veritabanına kaydedilir
4. **Backend:** Socket event'leri tetiklenir:
   - `new_message` → Alıcıya (`user:{recipientId}`) ve thread room'una (`thread:{threadId}`)
   - `message_sent` → Göndericiye (`user:{senderId}`)
5. **Frontend:** Socket üzerinden event'leri dinler ve UI'ı günceller

### Senaryo 2: Thread Room Yönetimi

1. **Frontend:** Thread sayfası açıldığında `socket.emit('join_thread', threadId)` gönderir
2. **Backend:** Thread erişim kontrolü yapılır (`validateThreadAccess`)
3. **Backend:** Socket `thread:{threadId}` room'una eklenir
4. **Backend:** `thread_joined` event'i gönderilir
5. **Frontend:** Thread room'undaki mesajları dinlemeye başlar

### Senaryo 3: Typing Indicator

1. **Frontend:** Kullanıcı input'a yazmaya başladığında `socket.emit('typing_start', { threadId })` gönderir
2. **Backend:** Thread erişim kontrolü yapılır
3. **Backend:** `user_typing` event'i thread room'undaki diğer kullanıcılara gönderilir (isTyping: true)
4. **Frontend:** Karşı taraf "yazıyor..." göstergesini görür
5. **Frontend:** Yazma durduğunda `socket.emit('typing_stop', { threadId })` gönderir
6. **Backend:** `user_typing` event'i gönderilir (isTyping: false)

### Senaryo 4: Mesaj Okundu

1. **Frontend:** `POST /messages/:messageId/read` endpoint'ine istek gönderir
2. **Backend:** `markMessageAsRead()` çağrılır
3. **Backend:** Mesaj okundu olarak işaretlenir
4. **Backend:** `message_read` event'i göndericiye ve thread room'una gönderilir
5. **Frontend:** Thread açıksa okundu bilgisini anında görür

---

## 📝 Önemli Notlar

### Güvenlik

- ✅ Tüm socket bağlantıları JWT authentication gerektirir
- ✅ Thread event'lerinde erişim kontrolü yapılır (`validateThreadAccess`)
- ✅ Kullanıcılar sadece kendi thread'lerine erişebilir

### Performance

- ✅ Redis adapter ile horizontal scaling desteklenir
- ✅ Thread room'ları gereksiz yere büyümez (leave_thread ile temizlenir)
- ✅ Typing event'leri için debounce/throttle eklenebilir (opsiyonel)

### Hata Yönetimi

- ✅ Tüm socket işlemleri try-catch ile korunur
- ✅ Hata durumlarında uygun event'ler gönderilir (`thread_join_error`)
- ✅ Tüm işlemler loglanır

---

## 🔄 Değişiklik Geçmişi

### Mevcut (Önceden Var Olan)

- Socket.IO temel altyapısı
- JWT authentication
- Kullanıcı odaları (`user:{userId}`)
- `connected`, `disconnect`, `ping`/`pong` event'leri
- Helper metodlar (sendMessageToUser, sendToRoom, vb.)
- `markMessageAsRead`'de socket kullanımı (sadece göndericiye)

### Yeni Eklenen (Mesajlaşma ile)

- `new_message` event'i (mesaj, TIPS, support request için)
- `message_sent` event'i (gönderici onayı)
- `message_read` event'i thread room'a da gönderiliyor
- `join_thread` / `leave_thread` event handler'ları
- `typing_start` / `typing_stop` event handler'ları
- Thread room yönetimi
- Thread erişim kontrolü (`validateThreadAccess`)

---

## 📚 İlgili Dosyalar

- `src/infrastructure/realtime/socket.handler.ts` - Socket event handler'ları
- `src/infrastructure/realtime/socket-manager.ts` - Socket manager singleton
- `src/infrastructure/realtime/messaging-events.ts` - Event interface'leri
- `src/infrastructure/config/socket.config.ts` - Socket konfigürasyonu
- `src/application/messaging/messaging.service.ts` - Mesajlaşma servisi
- `src/application/messaging/support-request.service.ts` - Support request servisi

---

**Son Güncelleme:** 2025-01-12  
**Versiyon:** 1.0.0

