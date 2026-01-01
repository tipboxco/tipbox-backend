# Inbox & Messaging API - Kapsamlı Dokümantasyon

Bu dokümantasyon, inbox/mesajlaşma sistemi için tüm endpoint'leri, socket event'lerini, ekran yapılarını ve mobil kullanım senaryolarını içerir.

**Base URL:** `/messages`

**Authentication:** Tüm endpoint'ler `Bearer Token` gerektirir.

**Socket URL:** `ws://your-domain/socket.io/` (WebSocket veya polling)

---

## 📱 Ekran Yapısı ve Kullanım Senaryoları

### 1. Inbox List Screen (Ana Mesaj Kutusu)

**Endpoint:** `GET /messages`

**Kullanım Senaryosu:**
- Kullanıcı uygulamayı açtığında inbox listesi gösterilir
- Thread'ler son mesaj zamanına göre sıralanır
- Okunmamış mesaj sayısı badge olarak gösterilir
- Arama ve filtreleme özellikleri mevcuttur

**Socket Bağlantısı:**
```typescript
// Socket bağlantısı kurulduğunda otomatik olarak kullanıcı room'una eklenir
socket.on('connected', (data) => {
  // Bağlantı başarılı
  // Yeni mesajlar için dinleme başlat
  socket.on('new_message', handleNewMessage);
});
```

**Yeni Mesaj Geldiğinde:**
```typescript
socket.on('new_message', (event) => {
  // Inbox listesini güncelle
  // Badge sayısını artır
  // Thread'i en üste taşı
  updateInboxList(event);
});
```

---

### 2. Chat Screen (Mesajlaşma Ekranı)

**Endpoint:** `GET /messages/:threadId`

**Kullanım Senaryosu:**
- Kullanıcı bir thread'e tıkladığında chat ekranı açılır
- Thread mesajları yüklenir (pagination ile)
- Socket ile thread room'una katılır
- Gerçek zamanlı mesaj alışverişi yapılır

**Socket Bağlantısı:**
```typescript
// Chat ekranı açıldığında
socket.emit('join_thread', { threadId });

socket.on('thread_joined', () => {
  // Thread'e başarıyla katıldı
  // Mesajları yükle
  loadMessages(threadId);
});

// Mesaj gönderme
socket.emit('send_message', {
  recipientId: recipientUserId,
  message: messageText
});

// Mesaj okundu işaretleme
socket.emit('mark_thread_read', { threadId });
```

**Gerçek Zamanlı Güncellemeler:**
```typescript
socket.on('new_message', (event) => {
  if (event.threadId === currentThreadId) {
    // Yeni mesajı ekrana ekle
    addMessageToChat(event);
    // Scroll'u en alta al
    scrollToBottom();
  }
});

socket.on('message_read', (event) => {
  // Mesaj okundu işaretini güncelle
  updateMessageReadStatus(event.messageId);
});

socket.on('user_typing', (event) => {
  // Karşı taraf yazıyor göstergesi
  showTypingIndicator(event.userId);
});
```

---

### 3. Support Request Screen (Destek Talebi Ekranı)

**Endpoint:** `GET /messages/support-requests`

**Kullanım Senaryosu:**
- Expert kullanıcılar destek taleplerini görüntüler
- Pending, active, completed durumlarına göre filtreleme yapılır
- Accept/Reject işlemleri socket veya REST API ile yapılabilir

**Socket Kullanımı:**
```typescript
// Support request accept
socket.emit('accept_support_request', { requestId });

socket.on('support_request_accepted', (data) => {
  // Support chat ekranına yönlendir
  navigateToSupportChat(data.threadId);
});

// Support request reject
socket.emit('reject_support_request', { requestId });

socket.on('support_request_rejected', (data) => {
  // Listeyi güncelle
  updateSupportRequestList(data.requestId, 'rejected');
});
```

---

### 4. Support Chat Screen (Destek Sohbet Ekranı)

**Endpoint:** `GET /messages/:threadId` (is_support_thread=true)

**Kullanım Senaryosu:**
- Support request accept edildikten sonra açılır
- Sadece SUPPORT context'li mesajlar gösterilir
- TIPS ve support-request mesajları bu ekranda görünmez

**Socket Kullanımı:**
```typescript
// Support mesajı gönder
socket.emit('send_support_message', {
  threadId: supportThreadId,
  message: messageText
});
```

---

## 📋 REST API Endpoint'leri

### 1. Inbox Listesi
**GET** `/messages`

Kullanıcının mesaj kutusundaki thread listesini döner.

**Query Parameters:**
- `search` (string, optional): Karşı tarafın adı, unvanı veya son mesaj içeriğinde arama
- `unreadOnly` (boolean, optional): Sadece okunmamış mesajı olan thread'leri döndürür
- `limit` (integer, optional): Maksimum thread sayısı (1-100, default: 50)

**Response:**
```json
[
  {
    "id": "thread-uuid",
    "senderName": "Ahmet Yılmaz",
    "senderTitle": "Expert",
    "senderAvatar": "https://...",
    "lastMessage": "Son mesaj içeriği",
    "timestamp": "2024-01-15T10:30:00Z",
    "isUnread": true,
    "unreadCount": 3
  }
]
```

**Error Responses:**
- `401 Unauthorized`: Token geçersiz veya eksik
- `500 Internal Server Error`: Sunucu hatası

---

### 2. Message Feed
**GET** `/messages/feed`

Kullanıcının mesajlarını, TIPS'leri ve 1-on-1 Support Request'lerini birleşik olarak getirir.

**Query Parameters:**
- `limit` (integer, optional): Maksimum feed item sayısı (1-100, default: 50)

**Response:**
```json
[
  {
    "id": "item-id",
    "type": "message" | "send-tips" | "support-request",
    "data": {
      "id": "...",
      "sender": { ... },
      "timestamp": "2024-01-15T10:30:00Z",
      ...
    }
  }
]
```

---

### 3. Direkt Mesaj Gönder
**POST** `/messages`

Kullanıcıya direkt mesaj gönderir. Mesaj gönderildiğinde `new_message` ve `message_sent` socket event'leri tetiklenir.

**Request Body:**
```json
{
  "recipientUserId": "uuid",
  "message": "Mesaj içeriği"
}
```

**Response:** `201 Created` (body yok)

**Error Responses:**
- `400 Bad Request`: `recipientUserId` veya `message` eksik
- `401 Unauthorized`: Token geçersiz
- `404 Not Found`: Alıcı kullanıcı bulunamadı

**Not:** Socket kullanımı önerilir: `send_message` event'i

---

### 4. Thread Oluştur veya Getir
**POST** `/messages/threads`

İki kullanıcı arasında thread oluşturur veya mevcut thread'i döndürür.

**Request Body:**
```json
{
  "recipientId": "uuid"
}
```

**Response:**
```json
{
  "id": "thread-uuid",
  "userOneId": "uuid",
  "userTwoId": "uuid",
  "isActive": true,
  "startedAt": "2024-01-15T10:30:00Z"
}
```

**Error Responses:**
- `400 Bad Request`: `recipientId` eksik
- `401 Unauthorized`: Token geçersiz
- `404 Not Found`: Alıcı kullanıcı bulunamadı

---

### 5. Support Request Listesi
**GET** `/messages/support-requests`

Kullanıcının birebir destek sohbetlerini getirir.

**Query Parameters:**
- `status` (string, optional): `pending`, `active`, `awaiting_completion`, `completed`, `finalized`, `reported`
- `search` (string, optional): Kullanıcı adı, unvanı veya istek açıklamasında arama
- `limit` (integer, optional): Maksimum destek sohbeti sayısı (1-100, default: 50)

**Response:**
```json
[
  {
    "id": "request-uuid",
    "userName": "Ahmet Yılmaz",
    "userTitle": "Expert",
    "userAvatar": "https://...",
    "requestDescription": "Yardıma ihtiyacım var",
    "status": "pending" | "active" | "awaiting_completion" | "completed" | "finalized" | "reported",
    "threadId": "thread-uuid" | null
  }
]
```

**Not:** `threadId`:
- `pending`: `null` (henüz accept edilmemiş)
- `accepted`: support thread ID (accept edildiğinde oluşturulan unique thread ID)
- `rejected`: `null`

---

### 6. Support Request Oluştur
**POST** `/messages/support-requests`

Bir kullanıcıya 1-on-1 destek talebi oluşturur. Talep oluşturulduğunda `new_message` socket event'i tetiklenir.

**Request Body:**
```json
{
  "senderUserId": "uuid",  // JWT token'daki userId ile eşleşmeli
  "recipientUserId": "uuid",
  "type": "GENERAL" | "TECHNICAL" | "PRODUCT",
  "message": "Yardıma ihtiyacım var",
  "amount": "50.00",  // String formatında
  "status": "pending",
  "timestamp": "2024-01-15T10:30:00Z"  // ISO 8601
}
```

**Response:** `201 Created` (body yok)

**Error Responses:**
- `400 Bad Request`: Eksik veya geçersiz parametreler
- `401 Unauthorized`: Token geçersiz
- `403 Forbidden`: `senderUserId` JWT token'daki userId ile eşleşmiyor

---

### 7. Support Request Accept
**POST** `/messages/support-requests/:requestId/accept`

Expert, support request'i accept eder ve yeni bir support thread oluşturulur.

**Response:**
```json
{
  "requestId": "request-uuid",
  "threadId": "thread-uuid"  // Oluşturulan support thread ID'si
}
```

**Error Responses:**
- `400 Bad Request`: Request zaten accept edilmiş
- `401 Unauthorized`: Token geçersiz
- `403 Forbidden`: Sadece recipient (expert) accept edebilir
- `404 Not Found`: Support request bulunamadı

**Not:** Bu thread ID ile `GET /messages/:threadId` çağrılarak support chat mesajları yüklenir.

**Socket Alternatifi:**
```typescript
socket.emit('accept_support_request', { requestId });
socket.on('support_request_accepted', (data) => {
  // data.threadId ile chat ekranına yönlendir
});
```

---

### 8. Support Request Reject
**POST** `/messages/support-requests/:requestId/reject`

Expert, support request'i reject eder.

**Response:** `200 OK`
```json
{
  "message": "Support request rejected"
}
```

**Error Responses:**
- `400 Bad Request`: Request zaten reject edilmiş
- `401 Unauthorized`: Token geçersiz
- `403 Forbidden`: Sadece recipient (expert) reject edebilir
- `404 Not Found`: Support request bulunamadı

**Socket Alternatifi:**
```typescript
socket.emit('reject_support_request', { requestId });
socket.on('support_request_rejected', (data) => {
  // Listeyi güncelle
});
```

---

### 9. Support Request Cancel
**POST** `/messages/support-requests/:requestId/cancel`

Destek talebini gönderen kullanıcı, talep kabul edilmeden önce iptal edebilir.

**Response:** `200 OK`
```json
{
  "message": "Support request cancelled"
}
```

**Error Responses:**
- `400 Bad Request`: Sadece pending talepler iptal edilebilir
- `401 Unauthorized`: Token geçersiz
- `403 Forbidden`: Sadece sender iptal edebilir
- `404 Not Found`: Support request bulunamadı

**Socket Alternatifi:**
```typescript
socket.emit('cancel_support_request', { requestId });
socket.on('support_request_cancelled', (data) => {
  // Listeyi güncelle
});
```

---

### 10. TIPS Gönder
**POST** `/messages/tips`

Bir kullanıcıya TIPS gönderir. TIPS gönderildiğinde `new_message` socket event'i `messageType: "send-tips"` ile tetiklenir.

**Request Body:**
```json
{
  "senderUserId": "uuid",  // JWT token'daki userId ile eşleşmeli
  "recipientUserId": "uuid",
  "message": "Teşekkürler!",
  "amount": 100.50,  // Number, minimum 0.01
  "timestamp": "2024-01-15T10:30:00Z"  // ISO 8601
}
```

**Response:** `201 Created` (body yok)

**Error Responses:**
- `400 Bad Request`: Eksik veya geçersiz parametreler (amount pozitif olmalı)
- `401 Unauthorized`: Token geçersiz
- `403 Forbidden`: `senderUserId` JWT token'daki userId ile eşleşmiyor

---

### 11. Mesaj Okundu İşaretle [DEPRECATED]
**POST** `/messages/:messageId/read`

⚠️ **DEPRECATED:** Bu endpoint artık kullanılmamalıdır. Bunun yerine socket event'i kullanın: `mark_message_read` veya `mark_thread_read`

**Socket Kullanımı (Önerilen):**
```typescript
// Tek mesaj okundu işaretle
socket.emit('mark_message_read', { messageId: '...' });
socket.on('message_read', (event) => {
  // Mesaj okundu işaretini güncelle
});

// Tüm thread mesajlarını okundu işaretle
socket.emit('mark_thread_read', { threadId: '...' });
socket.on('thread_read', (event) => {
  // Thread okundu işaretini güncelle
});
```

---

### 12. Thread Mesajlarını Getir
**GET** `/messages/:threadId`

Belirtilen thread'deki mesajları getirir. Thread tipine göre otomatik olarak doğru veri döndürülür.

**Query Parameters:**
- `limit` (integer, optional): Maksimum mesaj sayısı (1-100, default: 50)
- `offset` (integer, optional): Atlanacak mesaj sayısı (pagination için, default: 0)

**Thread Tipleri:**

**DM Thread (is_support_thread=false):**
- `type: "message"` - DM context'li mesajlar
- `type: "send-tips"` - TIPS transferleri
- `type: "support-request"` - Support request'ler (pending/accepted/rejected)

**Support Chat Thread (is_support_thread=true):**
- `type: "message"` - Sadece SUPPORT context'li mesajlar (TIPS ve support-request yok)

**Response:**
```json
[
  {
    "id": "msg-123",
    "type": "message",
    "data": {
      "id": "msg-123",
      "sender": {
        "id": "user-1",
        "senderName": "Ahmet Yılmaz",
        "senderTitle": "Expert",
        "senderAvatar": "https://..."
      },
      "lastMessage": "Merhaba!",
      "timestamp": "2024-01-15T10:30:00Z",
      "isUnread": false
    }
  },
  {
    "id": "tips-456",
    "type": "send-tips",
    "data": {
      "id": "tips-456",
      "sender": { ... },
      "amount": 100.50,
      "message": "Teşekkürler!",
      "timestamp": "2024-01-15T10:25:00Z"
    }
  },
  {
    "id": "req-789",
    "type": "support-request",
    "data": {
      "id": "req-789",
      "sender": { ... },
      "type": "GENERAL",
      "message": "Yardıma ihtiyacım var",
      "amount": 50,
      "status": "accepted",
      "timestamp": "2024-01-15T10:20:00Z",
      "threadId": "thread-uuid" | null
    }
  }
]
```

**Error Responses:**
- `400 Bad Request`: `threadId` eksik
- `401 Unauthorized`: Token geçersiz
- `403 Forbidden`: Thread'e erişim yetkisi yok
- `404 Not Found`: Thread bulunamadı

---

## 🔌 Socket Events - Detaylı Dokümantasyon

### Authentication

Socket bağlantısı için JWT token gerekir:

```typescript
const socket = io('ws://your-domain', {
  auth: {
    token: 'your-jwt-token'
  },
  transports: ['websocket', 'polling'],
  path: '/socket.io/'
});
```

---

### Incoming Events (Client → Server)

#### 1. `join_thread`
Thread room'una katıl. Chat ekranı açıldığında çağrılmalıdır.

```typescript
socket.emit('join_thread', { threadId: 'thread-uuid' });
```

**Response Events:**
- `thread_joined` - Başarılı
- `error` - Hata (Thread bulunamadı, yetkisiz erişim)

---

#### 2. `leave_thread`
Thread room'undan ayrıl. Chat ekranı kapatıldığında çağrılmalıdır.

```typescript
socket.emit('leave_thread', { threadId: 'thread-uuid' });
```

**Response Events:**
- `thread_left` - Başarılı

---

#### 3. `send_message`
Direkt mesaj gönder (DM). REST API yerine önerilir.

```typescript
socket.emit('send_message', {
  recipientId: 'user-uuid',
  message: 'Mesaj içeriği'
});
```

**Response Events:**
- `new_message` - Alıcıya gönderilir
- `message_sent` - Göndericiye onay
- `error` - Hata (Eksik parametre, boş mesaj)

---

#### 4. `send_support_message`
Support chat mesajı gönder. Sadece support thread'lerde kullanılır.

```typescript
socket.emit('send_support_message', {
  threadId: 'support-thread-uuid',
  message: 'Mesaj içeriği'
});
```

**Response Events:**
- `new_message` - Alıcıya gönderilir (context: 'SUPPORT')
- `error` - Hata (Thread bulunamadı, support thread değil, yetkisiz erişim)

---

#### 5. `mark_message_read`
Tek bir mesajı okundu işaretle.

```typescript
socket.emit('mark_message_read', { messageId: 'message-uuid' });
```

**Response Events:**
- `message_read` - Başarılı (göndericiye de bildirilir)
- `error` - Hata (Mesaj bulunamadı, kendi mesajını okundu işaretleyemez)

---

#### 6. `mark_thread_read`
Thread'deki tüm okunmamış mesajları okundu işaretle. Chat ekranı açıldığında çağrılmalıdır.

```typescript
socket.emit('mark_thread_read', { threadId: 'thread-uuid' });
```

**Response Events:**
- `thread_read` - Başarılı
- `message_read` - Her mesaj için göndericiye bildirilir
- `error` - Hata (Thread bulunamadı, yetkisiz erişim)

---

#### 7. `typing_start`
Yazıyor göstergesi başlat.

```typescript
socket.emit('typing_start', { threadId: 'thread-uuid' });
```

**Response Events:**
- `user_typing` - Karşı tarafa gönderilir (isTyping: true)

---

#### 8. `typing_stop`
Yazıyor göstergesi durdur.

```typescript
socket.emit('typing_stop', { threadId: 'thread-uuid' });
```

**Response Events:**
- `user_typing` - Karşı tarafa gönderilir (isTyping: false)

---

#### 9. `accept_support_request`
Support request'i accept et (Expert).

```typescript
socket.emit('accept_support_request', { requestId: 'request-uuid' });
```

**Response Events:**
- `support_request_accepted` - Başarılı (threadId içerir)
- `new_message` - Göndericiye bildirilir
- `error` - Hata (Request bulunamadı, sadece recipient accept edebilir, sadece pending request'ler)

---

#### 10. `reject_support_request`
Support request'i reject et (Expert).

```typescript
socket.emit('reject_support_request', { requestId: 'request-uuid' });
```

**Response Events:**
- `support_request_rejected` - Başarılı
- `new_message` - Göndericiye bildirilir
- `error` - Hata (Request bulunamadı, sadece recipient reject edebilir)

---

#### 11. `cancel_support_request`
Support request'i iptal et (Sender).

```typescript
socket.emit('cancel_support_request', { requestId: 'request-uuid' });
```

**Response Events:**
- `support_request_cancelled` - Başarılı
- `new_message` - Alıcıya bildirilir
- `error` - Hata (Request bulunamadı, sadece sender iptal edebilir)

---

### Outgoing Events (Server → Client)

#### 1. `connected`
Socket bağlantısı başarılı olduğunda gönderilir.

```typescript
socket.on('connected', (data) => {
  // data: { message, userId, userEmail }
});
```

---

#### 2. `new_message`
Yeni mesaj geldiğinde gönderilir.

```typescript
socket.on('new_message', (event) => {
  // event: {
  //   messageId: string;
  //   threadId: string | null;
  //   senderId: string;
  //   recipientId: string;
  //   message: string;
  //   messageType: 'message' | 'send-tips' | 'support-request';
  //   context?: 'DM' | 'SUPPORT';
  //   timestamp: string;
  // }
});
```

**Kullanım:**
- Inbox listesini güncelle
- Chat ekranında yeni mesajı göster
- Badge sayısını artır
- Bildirim göster

---

#### 3. `message_sent`
Mesaj gönderildi onayı (göndericiye).

```typescript
socket.on('message_sent', (event) => {
  // Mesaj gönderildi onayını göster
  // UI'da "gönderiliyor" durumunu kaldır
});
```

---

#### 4. `message_read`
Mesaj okundu (göndericiye bildirilir).

```typescript
socket.on('message_read', (event) => {
  // event: {
  //   messageId: string;
  //   threadId: string;
  //   readBy: string;
  //   timestamp: string;
  // }
  // Mesaj okundu işaretini güncelle
});
```

---

#### 5. `thread_read`
Thread okundu (tüm mesajlar okundu).

```typescript
socket.on('thread_read', (event) => {
  // event: {
  //   threadId: string;
  //   readBy: string;
  //   timestamp: string;
  // }
  // Thread okundu işaretini güncelle
});
```

---

#### 6. `user_typing`
Kullanıcı yazıyor göstergesi.

```typescript
socket.on('user_typing', (event) => {
  // event: {
  //   threadId: string;
  //   userId: string;
  //   isTyping: boolean;
  // }
  // Yazıyor göstergesini göster/gizle
});
```

---

#### 7. `thread_joined`
Thread'e katıldı onayı.

```typescript
socket.on('thread_joined', (event) => {
  // event: { threadId: string }
  // Thread'e başarıyla katıldı
});
```

---

#### 8. `thread_left`
Thread'den ayrıldı onayı.

```typescript
socket.on('thread_left', (event) => {
  // event: { threadId: string }
  // Thread'den ayrıldı
});
```

---

#### 9. `user_joined_thread`
Başka bir kullanıcı thread'e katıldı (opsiyonel).

```typescript
socket.on('user_joined_thread', (event) => {
  // event: { threadId: string; userId: string }
  // Kullanıcı thread'e katıldı
});
```

---

#### 10. `user_left_thread`
Başka bir kullanıcı thread'den ayrıldı (opsiyonel).

```typescript
socket.on('user_left_thread', (event) => {
  // event: { threadId: string; userId: string }
  // Kullanıcı thread'den ayrıldı
});
```

---

#### 11. `support_request_accepted`
Support request accept edildi.

```typescript
socket.on('support_request_accepted', (event) => {
  // event: {
  //   requestId: string;
  //   threadId: string;
  //   timestamp: string;
  // }
  // Support chat ekranına yönlendir
});
```

---

#### 12. `support_request_rejected`
Support request reject edildi.

```typescript
socket.on('support_request_rejected', (event) => {
  // event: {
  //   requestId: string;
  //   timestamp: string;
  // }
  // Listeyi güncelle
});
```

---

#### 13. `support_request_cancelled`
Support request iptal edildi.

```typescript
socket.on('support_request_cancelled', (event) => {
  // event: {
  //   requestId: string;
  //   timestamp: string;
  // }
  // Listeyi güncelle
});
```

---

#### 14. `error`
Hata durumunda gönderilir.

```typescript
socket.on('error', (error) => {
  // error: { message: string }
  // Hata mesajını göster
});
```

---

## 📱 Mobil Kullanım Senaryoları

### Senaryo 1: Uygulama Açılışı

```typescript
// 1. Socket bağlantısı kur
const socket = connectSocket(token);

// 2. Bağlantı onayını bekle
socket.on('connected', () => {
  // 3. Inbox listesini yükle
  fetchInboxList();
  
  // 4. Yeni mesajları dinle
  socket.on('new_message', handleNewMessage);
});
```

---

### Senaryo 2: Chat Ekranı Açılışı

```typescript
// 1. Thread ID ile mesajları yükle
const messages = await fetchThreadMessages(threadId);

// 2. Socket ile thread room'una katıl
socket.emit('join_thread', { threadId });

// 3. Thread'e katıldıktan sonra mesajları okundu işaretle
socket.on('thread_joined', () => {
  socket.emit('mark_thread_read', { threadId });
});

// 4. Gerçek zamanlı mesajları dinle
socket.on('new_message', (event) => {
  if (event.threadId === threadId) {
    addMessageToChat(event);
  }
});
```

---

### Senaryo 3: Mesaj Gönderme

```typescript
// Socket ile mesaj gönder (önerilen)
socket.emit('send_message', {
  recipientId: recipientUserId,
  message: messageText
});

// Gönderildi onayını bekle
socket.on('message_sent', () => {
  // UI'da "gönderiliyor" durumunu kaldır
});

// Hata durumu
socket.on('error', (error) => {
  // Hata mesajını göster
});
```

---

### Senaryo 4: Support Request Accept

```typescript
// Socket ile accept et (önerilen)
socket.emit('accept_support_request', { requestId });

// Accept onayını bekle
socket.on('support_request_accepted', (data) => {
  // Support chat ekranına yönlendir
  navigateToSupportChat(data.threadId);
});

// Alternatif: REST API
const response = await fetch(`/messages/support-requests/${requestId}/accept`, {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${token}` }
});
const { threadId } = await response.json();
navigateToSupportChat(threadId);
```

---

### Senaryo 5: Typing Indicator

```typescript
let typingTimeout: NodeJS.Timeout;

// Kullanıcı yazmaya başladığında
onTextChange(() => {
  socket.emit('typing_start', { threadId });
  
  // 3 saniye sonra otomatik durdur
  clearTimeout(typingTimeout);
  typingTimeout = setTimeout(() => {
    socket.emit('typing_stop', { threadId });
  }, 3000);
});

// Karşı taraf yazıyor
socket.on('user_typing', (event) => {
  if (event.isTyping) {
    showTypingIndicator(event.userId);
  } else {
    hideTypingIndicator(event.userId);
  }
});
```

---

### Senaryo 6: Background/Foreground Yönetimi

```typescript
// Uygulama background'a gittiğinde
onAppBackground(() => {
  // Socket bağlantısını koru (reconnection açık)
  // Mesajları dinlemeye devam et
});

// Uygulama foreground'a geldiğinde
onAppForeground(() => {
  // Inbox listesini yenile
  refreshInboxList();
  
  // Okunmamış mesaj sayısını kontrol et
  checkUnreadCount();
});
```

---

## 🔄 Best Practices

### 1. Socket vs REST API

**Socket Kullan:**
- Mesaj gönderme (`send_message`)
- Mesaj okundu işaretleme (`mark_message_read`, `mark_thread_read`)
- Support request işlemleri (`accept_support_request`, `reject_support_request`, `cancel_support_request`)
- Gerçek zamanlı güncellemeler için dinleme

**REST API Kullan:**
- İlk veri yükleme (inbox listesi, thread mesajları)
- Pagination
- Arama ve filtreleme

---

### 2. Error Handling

```typescript
// Socket error handling
socket.on('error', (error) => {
  console.error('Socket error:', error);
  // Kullanıcıya hata mesajı göster
  showError(error.message);
});

// REST API error handling
try {
  const response = await fetch('/messages', {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message);
  }
  
  const data = await response.json();
  return data;
} catch (error) {
  console.error('API error:', error);
  // Kullanıcıya hata mesajı göster
  showError(error.message);
}
```

---

### 3. Reconnection Strategy

```typescript
const socket = io('ws://your-domain', {
  auth: { token },
  reconnection: true,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  reconnectionAttempts: Infinity
});

socket.on('reconnect', () => {
  // Bağlantı yeniden kuruldu
  // Gerekli room'lara tekrar katıl
  rejoinThreads();
});
```

---

### 4. Message Queue (Offline Support)

```typescript
// Mesaj göndermeden önce queue'ya ekle
const messageQueue = [];

function sendMessage(recipientId, message) {
  const messageData = { recipientId, message, timestamp: Date.now() };
  
  if (socket.connected) {
    socket.emit('send_message', messageData);
  } else {
    // Offline: queue'ya ekle
    messageQueue.push(messageData);
  }
}

// Bağlantı kurulduğunda queue'daki mesajları gönder
socket.on('connect', () => {
  messageQueue.forEach(msg => {
    socket.emit('send_message', msg);
  });
  messageQueue = [];
});
```

---

## 📝 Özet

**En Çok Kullanılan Endpoint'ler:**

1. **GET `/messages`** - Inbox listesi
2. **GET `/messages/:threadId`** - Thread mesajlarını getir
3. **POST `/messages/threads`** - Thread oluştur/getir
4. **GET `/messages/support-requests`** - Support request listesi
5. **POST `/messages/support-requests`** - Support request oluştur
6. **POST `/messages/tips`** - TIPS gönder

**Socket Events (Önerilen):**

- `send_message` - Mesaj göndermek için (REST yerine)
- `mark_message_read` / `mark_thread_read` - Mesaj okundu işaretlemek için (REST yerine)
- `send_support_message` - Support mesajı göndermek için
- `accept_support_request` / `reject_support_request` / `cancel_support_request` - Support request işlemleri için
- `join_thread` / `leave_thread` - Thread room yönetimi için
- `typing_start` / `typing_stop` - Yazıyor göstergesi için

---

## ⚠️ Önemli Notlar

1. **Authentication:** Tüm endpoint'ler ve socket bağlantısı JWT token gerektirir
2. **Socket Events:** Mesaj göndermek ve okundu işaretlemek için socket event'leri kullanılması önerilir
3. **Thread ID:** Support request accept edildiğinde unique thread ID oluşturulur
4. **DEPRECATED:** `POST /messages/:messageId/read` endpoint'i kullanılmamalı, socket event kullanılmalı
5. **Thread Types:** DM thread ve Support thread farklı içerik döndürür
6. **Real-time Updates:** Socket event'leri ile gerçek zamanlı güncellemeler yapılır
7. **Error Handling:** Tüm hata durumları için uygun error handling yapılmalıdır
8. **Reconnection:** Socket bağlantısı için reconnection stratejisi uygulanmalıdır

---

**Son Güncelleme:** 2025-01-15  
**Versiyon:** 2.0.0  
**Backend Versiyonu:** Tipbox Backend v1.0
