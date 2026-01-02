# DM Thread API - Detaylı Dokümantasyon

Bu dokümantasyon, DM Thread sisteminin tüm detaylarını, API response yapılarını, mobil entegrasyon senaryolarını ve veri akışını içerir.

**Base URL:** `/messages`

**Authentication:** Tüm endpoint'ler `Bearer Token` gerektirir.

---

## 📋 İçindekiler

1. [Thread Tipleri ve Yapıları](#thread-tipleri-ve-yapıları)
2. [API Endpoint'leri](#api-endpointleri)
3. [Response Yapıları](#response-yapıları)
4. [Mobil Entegrasyon Kılavuzu](#mobil-entegrasyon-kılavuzu)
5. [Veri Akışı ve Senaryolar](#veri-akışı-ve-senaryolar)
6. [Önemli Notlar ve Edge Case'ler](#önemli-notlar-ve-edge-caseler)

---

## Thread Tipleri ve Yapıları

### 1. Normal DM Thread (`is_support_thread = false`)

**Açıklama:** İki kullanıcı arasındaki normal mesajlaşma thread'i. Bu thread'de:
- DM context'li mesajlar (`type: "message"`)
- TIPS transferleri (`type: "send-tips"`)
- Support request'ler (`type: "support-request"`) gösterilir

**Özellikler:**
- `userOneId` ve `userTwoId` ile iki kullanıcı arasında oluşturulur
- İlk mesaj gönderildiğinde otomatik oluşturulur
- Thread ID, mesajlaşma ekranında kullanılır

### 2. Support Chat Thread (`is_support_thread = true`)

**Açıklama:** Bir support request accept edildiğinde oluşturulan özel thread. Bu thread'de:
- Sadece SUPPORT context'li mesajlar (`type: "message"`) gösterilir
- TIPS ve support-request gösterilmez

**Özellikler:**
- Her support request accept edildiğinde **yeni bir unique thread** oluşturulur
- Thread ID, `DMRequest.threadId` field'ına kaydedilir
- Support chat ekranı açılırken bu thread ID kullanılır

---

## API Endpoint'leri

### 1. Inbox Listesi Getir

**Endpoint:** `GET /messages`

**Query Parameters:**
- `search` (string, optional): Karşı tarafın adı, unvanı veya son mesaj içeriğinde arama
- `unreadOnly` (boolean, optional): Sadece okunmamış mesajı olan thread'leri döndür
- `limit` (number, optional, default: 50, max: 100): Maksimum thread sayısı

**Response (200):**
```json
[
  {
    "id": "thread-uuid",
    "recipientUserId": "user-2-uuid",
    "senderName": "Ahmet Yılmaz",
    "senderTitle": "Expert",
    "senderAvatar": "https://...",
    "lastMessage": "Son mesaj metni",
    "timestamp": "2024-01-15T10:30:00.000Z",
    "isUnread": false,
    "unreadCount": 0,
    "threadType": "DM"
  }
]
```

**Önemli Notlar:**
- `id`: Thread ID (DM thread veya Support thread ID'si)
- `recipientUserId`: Karşı tarafın (diğer kullanıcının) ID'si - MessageDetail'e navigate etmek için kullanılır
- `senderName`, `senderTitle`, `senderAvatar`: Karşı tarafın (diğer kullanıcının) bilgileri
- `lastMessage`: Thread'deki en son mesaj metni
- `isUnread`: Thread'de okunmamış mesaj var mı?
- `unreadCount`: Okunmamış mesaj sayısı
- `threadType`: Thread tipi bilgisi (`"DM"` veya `"SUPPORT"`)

---

### 2. Thread Detay Bilgisini Getir

**Endpoint:** `GET /messages/threads/:threadId`

**Path Parameters:**
- `threadId` (string, required): Thread ID

**Response (200):**
```json
{
  "id": "thread-uuid",
  "userOneId": "user-1-uuid",
  "userTwoId": "user-2-uuid",
  "isActive": true,
  "startedAt": "2024-01-15T10:30:00.000Z",
  "isSupportThread": false
}
```

**Önemli Notlar:**
- `userOneId` ve `userTwoId`: Thread'deki iki kullanıcının ID'leri
- `isSupportThread`: Support thread mi, normal DM thread mi? (`true` = Support thread, `false` = Normal DM thread)
- Thread'e erişim yetkisi olmayan kullanıcılar için `403 Forbidden` döner

**Kullanım Senaryosu:**
- Mobil taraf thread'den diğer kullanıcıyı bulmak için bu endpoint'i kullanabilir
- `recipientUserId` hesaplamak için `userOneId` ve `userTwoId` bilgisi gerekli

---

### 3. Thread Mesajlarını Getir

**Endpoint:** `GET /messages/:threadId`

**Path Parameters:**
- `threadId` (string, required): Thread ID (DM thread veya Support Chat thread ID'si)

**Query Parameters:**
- `limit` (number, optional, default: 50, max: 100): Maksimum mesaj sayısı
- `offset` (number, optional, default: 0): Atlanacak mesaj sayısı (pagination)

**Response (200):** `MessageFeedItem[]`

Thread tipine göre farklı içerik döner:

#### A. Normal DM Thread Response

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
      "timestamp": "2024-01-15T10:30:00.000Z",
      "isUnread": false
    }
  },
  {
    "id": "tips-456",
    "type": "send-tips",
    "data": {
      "id": "tips-456",
      "sender": {
        "id": "user-1",
        "senderName": "Ahmet Yılmaz",
        "senderTitle": "Expert",
        "senderAvatar": "https://..."
      },
      "amount": 100.50,
      "message": "Teşekkürler!",
      "timestamp": "2024-01-15T10:25:00.000Z"
    }
  },
  {
    "id": "req-789",
    "type": "support-request",
    "data": {
      "id": "req-789",
      "sender": {
        "id": "user-1",
        "senderName": "Ahmet Yılmaz",
        "senderTitle": "Expert",
        "senderAvatar": "https://..."
      },
      "type": "GENERAL",
      "message": "Yardıma ihtiyacım var",
      "amount": 50,
      "status": "accepted",
      "timestamp": "2024-01-15T10:20:00.000Z",
      "threadId": "1f2d6cb7-aef1-4221-8dba-2cd0601faae3",
      "requestId": "req-789",
      "fromUserId": "user-1",
      "toUserId": "user-2"
    }
  },
  {
    "id": "req-790",
    "type": "support-request",
    "data": {
      "id": "req-790",
      "sender": {
        "id": "user-1",
        "senderName": "Ahmet Yılmaz",
        "senderTitle": "Expert",
        "senderAvatar": "https://..."
      },
      "type": "TECHNICAL",
      "message": "Teknik destek istiyorum",
      "amount": 100,
      "status": "pending",
      "timestamp": "2024-01-15T10:15:00.000Z",
      "threadId": null,
      "requestId": "req-790",
      "fromUserId": "user-1",
      "toUserId": "user-2"
    }
  }
]
```

#### B. Support Chat Thread Response

```json
[
  {
    "id": "msg-456",
    "type": "message",
    "data": {
      "id": "msg-456",
      "sender": {
        "id": "user-1",
        "senderName": "Ahmet Yılmaz",
        "senderTitle": "Expert",
        "senderAvatar": "https://..."
      },
      "lastMessage": "Smartwatch kurulumu için yardıma ihtiyacım var.",
      "timestamp": "2024-01-15T10:30:00.000Z",
      "isUnread": false
    }
  },
  {
    "id": "msg-457",
    "type": "message",
    "data": {
      "id": "msg-457",
      "sender": {
        "id": "user-2",
        "senderName": "Ayşe Demir",
        "senderTitle": "Support Expert",
        "senderAvatar": "https://..."
      },
      "lastMessage": "Size yardımcı olabilirim. Hangi model?",
      "timestamp": "2024-01-15T10:31:00.000Z",
      "isUnread": false
    }
  }
]
```

**Önemli Notlar:**
- Mesajlar **timestamp'e göre sıralı** döner (en eski önce - WhatsApp tarzı)
- Support thread'lerde sadece `type: "message"` item'ları döner
- Normal DM thread'lerde `type: "message"`, `type: "send-tips"`, `type: "support-request"` item'ları döner

---

### 4. Message Feed Getir

**Endpoint:** `GET /messages/feed`

**Query Parameters:**
- `limit` (number, optional, default: 50, max: 100): Maksimum feed item sayısı

**Response (200):**
```json
{
  "messages": [
    {
      "id": "msg-1",
      "type": "message",
      "data": {
        "id": "msg-1",
        "sender": { ... },
        "lastMessage": "Merhaba!",
        "timestamp": "2024-01-15T10:30:00.000Z",
        "isUnread": false
      }
    },
    {
      "id": "tips-1",
      "type": "send-tips",
      "data": {
        "id": "tips-1",
        "sender": { ... },
        "amount": 100.50,
        "message": "Teşekkürler!",
        "timestamp": "2024-01-15T10:25:00.000Z"
      }
    },
    {
      "id": "req-1",
      "type": "support-request",
      "data": {
        "id": "req-1",
        "sender": { ... },
        "type": "GENERAL",
        "message": "Yardıma ihtiyacım var",
        "amount": 50,
        "status": "pending",
        "timestamp": "2024-01-15T10:20:00.000Z",
        "threadId": null
      }
    }
  ]
}
```

---

## Response Yapıları

### MessageFeedItem

```typescript
interface MessageFeedItem {
  id: string;              // Item ID (mesaj ID, TIPS ID, veya support request ID)
  type: 'message' | 'support-request' | 'send-tips';
  data: Message | SupportRequest | TipsInfo;
}
```

### Message (type: "message")

```typescript
interface Message {
  id: string;              // DMMessage.id
  sender: SenderUser;      // Mesajı gönderen kullanıcı bilgileri
  lastMessage: string;     // Mesaj metni
  timestamp: string;       // ISO 8601 formatında timestamp
  isUnread: boolean;       // Okunmamış mı?
}
```

**Önemli Notlar:**
- `sender.id`: Mesajı gönderen kullanıcının ID'si
- `sender.senderName`: Gönderenin adı (displayName, userName veya email)
- `sender.senderTitle`: Gönderenin unvanı (en son kazanılan unvan)
- `sender.senderAvatar`: Gönderenin avatar URL'i

### SupportRequest (type: "support-request")

```typescript
interface SupportRequest {
  id: string;              // DMRequest.id
  sender: SenderUser;      // Request'i oluşturan kullanıcı (fromUser)
  type: 'GENERAL' | 'TECHNICAL' | 'PRODUCT';
  message: string;         // Request açıklaması (description)
  amount: number;          // Request tutarı
  status: 'pending' | 'accepted' | 'rejected' | 'canceled' | 'awaiting_completion' | 'completed' | 'reported';
  timestamp: string;       // ISO 8601 formatında timestamp
  threadId: string | null; // Support thread ID (accept edildiyse, yoksa null)
  requestId?: string;      // DMRequest.id (duplicate, backward compatibility için)
  fromUserId: string;     // Request'i oluşturan kullanıcı ID'si (required)
  toUserId: string;       // Request'in gönderildiği kullanıcı ID'si (required)
}
```

**Önemli Notlar:**
- `sender`: Her zaman request'i oluşturan kişidir (`fromUser`)
- `threadId`:
  - `status: "pending"` → `null` (henüz accept edilmemiş, thread oluşturulmamış)
  - `status: "accepted"` → `"uuid"` (accept edildiğinde oluşturulan unique support thread ID)
  - `status: "rejected"` → `null`
  - `status: "canceled"` → `null`
- `fromUserId` ve `toUserId`: Request'in gönderen ve alıcı bilgileri (required, her zaman döner)

### TipsInfo (type: "send-tips")

```typescript
interface TipsInfo {
  id: string;              // TipsTokenTransfer.id
  sender: SenderUser;     // TIPS'i gönderen kullanıcı (fromUser)
  amount: number;          // TIPS tutarı
  message: string;         // TIPS mesajı (reason)
  timestamp: string;       // ISO 8601 formatında timestamp
}
```

**Önemli Notlar:**
- `sender`: Her zaman TIPS'i gönderen kişidir (`fromUser`)

### SenderUser

```typescript
interface SenderUser {
  id: string;              // User.id
  senderName: string;      // displayName, userName veya email
  senderTitle: string;     // En son kazanılan unvan (boş string olabilir)
  senderAvatar: string;    // Avatar URL (default avatar olabilir)
}
```

---

## Mobil Entegrasyon Kılavuzu

### Senaryo 1: Inbox Listesinden Thread'e Tıklama

**Adımlar:**
1. `GET /messages` ile inbox listesi alınır
2. Kullanıcı bir thread'e tıklar
3. Thread ID ile `GET /messages/:threadId` çağrısı yapılır
4. Mesajlar gösterilir

**Kod Örneği:**
```typescript
// 1. Inbox listesi al
const inboxResponse = await fetch('/messages', {
  headers: { 'Authorization': `Bearer ${token}` }
});
const inboxItems = await inboxResponse.json();

// 2. Thread'e tıklandığında
const threadId = inboxItem.id; // Thread ID
const recipientUserId = inboxItem.recipientUserId; // ✅ Artık direkt response'da var
const threadType = inboxItem.threadType; // ✅ Thread tipi bilgisi

// 3. Thread mesajlarını al
const messagesResponse = await fetch(`/messages/${threadId}`, {
  headers: { 'Authorization': `Bearer ${token}` }
});
const messages = await messagesResponse.json();

// 4. Mesajları göster
messages.forEach(item => {
  if (item.type === 'message') {
    const message = item.data as Message;
    // message.sender.id → Gönderen ID
    // message.sender.senderName → Gönderen adı
    // message.lastMessage → Mesaj metni
  } else if (item.type === 'support-request') {
    const request = item.data as SupportRequest;
    // request.sender.id → Request'i oluşturan ID
    // request.threadId → Support thread ID (null olabilir)
    // request.fromUserId → Request gönderen ID (required)
    // request.toUserId → Request alıcı ID (required)
  }
});
```

### Senaryo 2: Support Request'ten Support Chat'e Geçiş

**Adımlar:**
1. Normal DM thread'de `type: "support-request"` item'ı görülür
2. Request'in `status` ve `threadId` kontrol edilir:
   - `status: "accepted"` ve `threadId !== null` → Support chat açılabilir
   - `status: "pending"` → Henüz accept edilmemiş, chat açılamaz
3. `threadId` ile `GET /messages/:threadId` çağrısı yapılır (Support chat thread)

**Kod Örneği:**
```typescript
// DM thread'de support request item'ı görüldüğünde
const request = item.data as SupportRequest;

if (request.status === 'accepted' && request.threadId) {
  // Support chat açılabilir
  const supportThreadId = request.threadId;
  const supportMessagesResponse = await fetch(`/messages/${supportThreadId}`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const supportMessages = await supportMessagesResponse.json();
  // Support chat mesajları gösterilir (sadece type: "message" item'ları)
} else {
  // Henüz accept edilmemiş veya thread oluşturulmamış
  // Support chat açılamaz
}
```

### Senaryo 3: MessageDetail Ekranına Navigasyon

**Problem:** Mobil tarafta `message.id` ve `recipientUserId` karmaşası var.

**Çözüm:**

#### A. Normal DM Thread'den MessageDetail'e Geçiş

```typescript
// GET /messages/:threadId response'undan bir message item'ı alındığında
const messageItem = messages.find(m => m.id === messageId);

if (messageItem && messageItem.type === 'message') {
  const message = messageItem.data as Message;
  
  // recipientUserId belirleme:
  // - Eğer current user message.sender.id ise → recipientUserId = thread'deki diğer kullanıcı
  // - Eğer current user message.sender.id değilse → recipientUserId = message.sender.id
  
  const currentUserId = user?.id;
  const recipientUserId = message.sender.id === currentUserId
    ? getOtherUserIdFromThread(threadId, currentUserId) // Thread'den diğer kullanıcıyı al
    : message.sender.id; // Karşı tarafın ID'si
  
  // MessageDetail ekranına git
  navigation.navigate('MessageDetail', {
    recipientUserId: recipientUserId,
    threadId: threadId // Thread ID'yi de gönder
  });
}
```

#### B. Support Request'ten MessageDetail'e Geçiş

```typescript
// GET /messages/:threadId response'undan bir support-request item'ı alındığında
const requestItem = messages.find(m => m.id === requestId);

if (requestItem && requestItem.type === 'support-request') {
  const request = requestItem.data as SupportRequest;
  
  // Support request için recipientUserId:
  // - request.fromUserId → Request'i oluşturan
  // - request.toUserId → Request'in gönderildiği kişi
  // - current user hangisi ise, diğeri recipientUserId olur
  
  const currentUserId = user?.id;
  const recipientUserId = request.fromUserId === currentUserId
    ? request.toUserId
    : request.fromUserId;
  
  // MessageDetail ekranına git (support request için)
  navigation.navigate('MessageDetail', {
    recipientUserId: recipientUserId,
    threadId: request.threadId || null, // Support thread ID (null olabilir)
    requestId: request.id // Request ID'yi de gönder
  });
}
```

#### C. Inbox Listesinden MessageDetail'e Geçiş

```typescript
// GET /messages response'undan bir inbox item'ı alındığında
const inboxItem = inboxItems.find(item => item.id === threadId);

// ✅ Artık recipientUserId direkt response'da var
const recipientUserId = inboxItem.recipientUserId;

// Direkt MessageDetail'e navigate edebiliriz
navigation.navigate('MessageDetail', {
  recipientUserId: recipientUserId,
  threadId: threadId
});
```

**Alternatif:** Thread detay bilgisi gerekirse `GET /messages/threads/:threadId` endpoint'i kullanılabilir.

---

## Veri Akışı ve Senaryolar

### Senaryo 1: Normal Mesajlaşma

1. **Kullanıcı A**, **Kullanıcı B**'ye mesaj gönderir
2. Backend otomatik olarak normal DM thread oluşturur (yoksa)
3. Mesaj `DMMessage` tablosuna kaydedilir (`context: "DM"`)
4. `GET /messages/:threadId` çağrısında `type: "message"` item'ı döner
5. Mobil taraf mesajı gösterir

### Senaryo 2: TIPS Transferi

1. **Kullanıcı A**, **Kullanıcı B**'ye TIPS gönderir
2. `TipsTokenTransfer` kaydı oluşturulur
3. Normal DM thread'de `type: "send-tips"` item'ı görünür
4. Mobil taraf TIPS transferini gösterir

### Senaryo 3: Support Request Oluşturma ve Accept

1. **Kullanıcı A**, **Kullanıcı B**'ye support request gönderir
2. `DMRequest` kaydı oluşturulur (`status: "PENDING"`, `threadId: null`)
3. Normal DM thread'de `type: "support-request"` item'ı görünür (`status: "pending"`, `threadId: null`)
4. **Kullanıcı B** request'i accept eder
5. Backend yeni bir support thread oluşturur (`is_support_thread: true`)
6. `DMRequest.threadId` güncellenir (yeni support thread ID'si)
7. Normal DM thread'de `type: "support-request"` item'ı güncellenir (`status: "accepted"`, `threadId: "support-thread-uuid"`)
8. Mobil taraf support chat'i açabilir (`GET /messages/:supportThreadId`)

### Senaryo 4: Support Chat Mesajlaşması

1. Support request accept edildikten sonra support thread oluşturulur
2. **Kullanıcı A** support chat'te mesaj gönderir
3. Mesaj `DMMessage` tablosuna kaydedilir (`context: "SUPPORT"`)
4. `GET /messages/:supportThreadId` çağrısında sadece `type: "message"` item'ları döner (SUPPORT context'li)
5. Mobil taraf support chat mesajlarını gösterir

---

## Önemli Notlar ve Edge Case'ler

### 1. Thread ID ve Message ID Karmaşası

**Problem:** Mobil tarafta `message.id` bazen thread ID, bazen message ID olarak kullanılıyor.

**Çözüm:**
- `GET /messages/:threadId` response'unda `item.id`:
  - `type: "message"` → `DMMessage.id` (mesaj ID'si)
  - `type: "send-tips"` → `TipsTokenTransfer.id` (TIPS transfer ID'si)
  - `type: "support-request"` → `DMRequest.id` (request ID'si)
- Thread ID her zaman endpoint path'inde kullanılır (`/messages/:threadId`)
- MessageDetail ekranına giderken `recipientUserId` thread'den veya message'dan alınmalı

### 2. Sender ve Recipient Bilgisi

**Problem:** Mobil tarafta `senderId` ve `recipientId` bilgisi her zaman mevcut değil.

**Çözüm:**
- `GET /messages` response'unda her inbox item için `recipientUserId` direkt var
- `GET /messages/:threadId` response'unda her item'da `sender` bilgisi var
- Thread detay bilgisi için `GET /messages/threads/:threadId` endpoint'i kullanılabilir
- `recipientUserId` hesaplama:
  ```typescript
  // Inbox listesinden:
  const recipientUserId = inboxItem.recipientUserId; // ✅ Direkt var
  
  // Thread mesajlarından:
  const currentUserId = user?.id;
  const recipientUserId = message.sender.id === currentUserId
    ? getOtherUserIdFromThread(threadId, currentUserId) // GET /messages/threads/:threadId kullan
    : message.sender.id; // Karşı tarafın ID'si
  ```
- Support request için `fromUserId` ve `toUserId` bilgisi `SupportRequest` içinde mevcut (required)

### 3. Support Request Thread ID

**Problem:** Support request'in `threadId` field'ı bazen `null`, bazen UUID.

**Açıklama:**
- `status: "pending"` → `threadId: null` (henüz accept edilmemiş)
- `status: "accepted"` → `threadId: "uuid"` (support thread ID'si)
- `status: "rejected"` → `threadId: null`
- `status: "canceled"` → `threadId: null`

**Kullanım:**
```typescript
if (request.status === 'accepted' && request.threadId) {
  // Support chat açılabilir
  const supportThreadId = request.threadId;
  // GET /messages/:supportThreadId çağrısı yap
} else {
  // Support chat açılamaz
}
```

### 4. Context Filtreleme

**Normal DM Thread:**
- Sadece `context: "DM"` veya `context: null` mesajlar gösterilir
- `context: "SUPPORT"` mesajlar gösterilmez

**Support Chat Thread:**
- Sadece `context: "SUPPORT"` mesajlar gösterilir
- `context: "DM"` mesajlar gösterilmez

### 5. TIPS Mesajları

**Problem:** TIPS transferi yapıldığında hem `TipsTokenTransfer` kaydı, hem de `DMMessage` kaydı oluşturuluyor.

**Çözüm:**
- `GET /messages/:threadId` response'unda TIPS mesajları (`DMMessage` içinde "Sent X TIPS" metni olanlar) filtrelenir
- Sadece `TipsTokenTransfer` kayıtları `type: "send-tips"` olarak döner
- Duplicate önlenir

### 6. Pagination

**Önemli:**
- `GET /messages/:threadId` endpoint'i `limit` ve `offset` parametreleri alır
- Mesajlar timestamp'e göre sıralı döner (en eski önce)
- Mobil taraf scroll yaparken `offset` artırılmalı

**Örnek:**
```typescript
let offset = 0;
const limit = 50;

// İlk yükleme
const messages = await fetch(`/messages/${threadId}?limit=${limit}&offset=${offset}`);

// Daha fazla yükleme (scroll)
offset += limit;
const moreMessages = await fetch(`/messages/${threadId}?limit=${limit}&offset=${offset}`);
```

### 7. Thread Erişim Kontrolü

**Önemli:**
- `GET /messages/:threadId` endpoint'i thread'e erişim kontrolü yapar
- Kullanıcı thread'in `userOneId` veya `userTwoId`'si olmalı
- Aksi halde `403 Forbidden` döner

### 8. Timestamp Sıralaması

**Önemli:**
- Tüm item'lar (mesaj, TIPS, support request) timestamp'e göre sıralı döner
- En eski item en başta, en yeni item en sonda
- WhatsApp tarzı mesajlaşma için uygundur

---

## Örnek Mobil Kod Yapısı

### TypeScript Interface'leri

```typescript
// Backend'den gelen response'lar için
interface MessageFeedItem {
  id: string;
  type: 'message' | 'support-request' | 'send-tips';
  data: Message | SupportRequest | TipsInfo;
}

interface Message {
  id: string;
  sender: SenderUser;
  lastMessage: string;
  timestamp: string;
  isUnread: boolean;
}

interface SupportRequest {
  id: string;
  sender: SenderUser;
  type: 'GENERAL' | 'TECHNICAL' | 'PRODUCT';
  message: string;
  amount: number;
  status: 'pending' | 'accepted' | 'rejected' | 'canceled' | 'awaiting_completion' | 'completed' | 'reported';
  timestamp: string;
  threadId: string | null;
  requestId?: string;
  fromUserId: string; // Required
  toUserId: string; // Required
}

interface TipsInfo {
  id: string;
  sender: SenderUser;
  amount: number;
  message: string;
  timestamp: string;
}

interface SenderUser {
  id: string;
  senderName: string;
  senderTitle: string;
  senderAvatar: string;
}
```

### Helper Fonksiyonlar

```typescript
/**
 * Thread'deki diğer kullanıcıyı bul
 * GET /messages/threads/:threadId endpoint'i kullanılır
 */
async function getOtherUserIdFromThread(
  threadId: string,
  currentUserId: string
): Promise<string | null> {
  try {
    const response = await fetch(`/messages/threads/${threadId}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const thread = await response.json();
    
    // Thread'deki diğer kullanıcıyı bul
    return thread.userOneId === currentUserId
      ? thread.userTwoId
      : thread.userOneId;
  } catch (error) {
    console.error('Failed to get thread details:', error);
    return null;
  }
}

/**
 * MessageDetail ekranına gitmek için recipientUserId hesapla
 */
async function getRecipientUserId(
  messageItem: MessageFeedItem,
  threadId: string,
  currentUserId: string
): Promise<string | null> {
  if (messageItem.type === 'message') {
    const message = messageItem.data as Message;
    return message.sender.id === currentUserId
      ? await getOtherUserIdFromThread(threadId, currentUserId)
      : message.sender.id;
  } else if (messageItem.type === 'support-request') {
    const request = messageItem.data as SupportRequest;
    // fromUserId ve toUserId artık required, her zaman var
    return request.fromUserId === currentUserId
      ? request.toUserId
      : request.fromUserId;
  }
  return null;
}
```

---

## Sonuç

Bu dokümantasyon, DM Thread sisteminin tüm detaylarını içerir. Mobil taraf için önemli noktalar:

1. **Thread ID vs Message ID:** Thread ID endpoint path'inde, message ID response'da
2. **Sender ve Recipient:** 
   - `GET /messages` response'unda her inbox item için `recipientUserId` direkt var
   - Thread detay bilgisi için `GET /messages/threads/:threadId` endpoint'i kullanılabilir
3. **Support Request Thread ID:** `status: "accepted"` ve `threadId !== null` ise support chat açılabilir
4. **Support Request User IDs:** `fromUserId` ve `toUserId` artık required, her zaman döner
5. **Context Filtreleme:** Normal DM thread'de DM context, Support thread'de SUPPORT context
6. **Pagination:** `limit` ve `offset` parametreleri ile sayfalama yapılır
7. **Thread Type:** Inbox listesinde `threadType` field'ı ile thread tipi bilgisi mevcut

Sorularınız için backend ekibiyle iletişime geçin.

