# Mesajlaşma Socket Entegrasyonu - Geliştirme Akış Dokümantasyonu

## 📋 Genel Bakış

Mevcut Socket.IO altyapısı üzerine mesajlaşma için real-time bildirimler ve event handler'lar ekleniyor. Redis PubSub gerekmez çünkü Socket.IO zaten Redis adapter kullanıyor.

## 🔍 Mevcut Durum

**Mevcut Altyapı:**
- ✅ Socket.IO kurulu ve çalışıyor
- ✅ Redis adapter ile horizontal scaling destekleniyor
- ✅ JWT authentication çalışıyor
- ✅ Kullanıcılar kendi userId odalarına otomatik katılıyor
- ✅ `markMessageAsRead` metodunda socket bildirimi var
- ❌ `sendDirectMessage` metodunda socket bildirimi yok

## 🎯 Yapılacak İşler

### 1. MessagingService - sendDirectMessage Metoduna Socket Bildirimi Ekle

**Konum:** `src/application/messaging/messaging.service.ts`

**Yapılacaklar:**
- `sendDirectMessage` metodunda mesaj veritabanına kaydedildikten sonra:
  - SocketManager'dan SocketHandler'ı al
  - Alıcı kullanıcıya `new_message` event'i gönder
  - Payload içeriği: messageId, threadId, senderId, message, messageType, timestamp
  - Göndericiye `message_sent` event'i gönder (opsiyonel, onay için)
  - Thread room'una da mesaj gönder (her iki kullanıcı da dinliyorsa)

**Önemli Not:** Mesaj oluşturulduktan sonra oluşturulan mesaj objesini kullan (id, sentAt gibi alanlar için)

---

### 2. MessagingService - sendTips Metoduna Socket Bildirimi Ekle

**Konum:** `src/application/messaging/messaging.service.ts`

**Yapılacaklar:**
- `sendTips` metodunda `sendDirectMessage` çağrıldıktan sonra:
  - TIPS transferi için özel bir socket event'i gönderilebilir
  - Veya `sendDirectMessage` içindeki bildirim yeterli olabilir
  - Karar: TIPS için ayrı bir event mi yoksa genel mesaj event'i mi?

**Öneri:** Önce genel mesaj event'i ile başla, gerekirse sonra ayrı event ekle

---

### 3. SocketHandler - Mesajlaşma Event Handler'ları Ekle

**Konum:** `src/infrastructure/realtime/socket.handler.ts`

**Yapılacaklar:**

#### 3.1. join_thread Event Handler
- Client'tan `join_thread` event'i geldiğinde:
  - Thread ID'yi al
  - Room adı: `thread:{threadId}` formatında
  - Socket'i bu room'a ekle
  - Log'la

**Kontrol:** Kullanıcının bu thread'e erişim yetkisi var mı kontrol et (MessagingService'den thread bilgisini al ve kullanıcının participant olduğunu doğrula)

#### 3.2. leave_thread Event Handler
- Client'tan `leave_thread` event'i geldiğinde:
  - Thread ID'yi al
  - Room adı: `thread:{threadId}` formatında
  - Socket'i bu room'dan çıkar
  - Log'la

#### 3.3. typing_start Event Handler
- Client'tan `typing_start` event'i geldiğinde:
  - Thread ID'yi al
  - Room adı: `thread:{threadId}` formatında
  - Socket'in kendisi hariç room'daki diğer kullanıcılara `user_typing` event'i gönder
  - Payload: userId, threadId, isTyping: true
  - Thread'e erişim kontrolü yap

#### 3.4. typing_stop Event Handler
- Client'tan `typing_stop` event'i geldiğinde:
  - Thread ID'yi al
  - Room adı: `thread:{threadId}` formatında
  - Socket'in kendisi hariç room'daki diğer kullanıcılara `user_typing` event'i gönder
  - Payload: userId, threadId, isTyping: false
  - Thread'e erişim kontrolü yap

**Not:** Typing event'leri için debounce/throttle eklenebilir (opsiyonel, ilk versiyonda gerekli değil)

---

### 4. MessagingService - Thread Room Yönetimi

**Konum:** `src/application/messaging/messaging.service.ts`

**Yapılacaklar:**
- `sendDirectMessage` metodunda:
  - Mesaj gönderildikten sonra thread room'una da mesaj gönder
  - Room adı: `thread:{threadId}`
  - Bu sayede thread'i açık olan her iki kullanıcı da mesajı anında görür
  - Ayrıca alıcı kullanıcının kendi odasına da gönder (thread açık değilse bile bildirim gelsin)

**Mantık:**
- Thread room'una gönder → Thread açık olan kullanıcılar için
- Kullanıcı odasına gönder → Thread açık olmayan kullanıcılar için bildirim

---

### 5. Event Payload Standardizasyonu

**Konum:** Yeni dosya oluştur: `src/infrastructure/realtime/messaging-events.ts`

**Yapılacaklar:**
- TypeScript interface'leri tanımla:
  - `NewMessageEvent`: messageId, threadId, senderId, recipientId, message, messageType, timestamp
  - `MessageReadEvent`: messageId, threadId, readBy, timestamp (zaten var ama standardize et)
  - `TypingEvent`: userId, threadId, isTyping
  - `MessageSentEvent`: messageId, threadId, recipientId, timestamp (opsiyonel)

**Kullanım:** Bu interface'leri hem backend'de hem frontend dokümantasyonunda kullan

---

### 6. SocketHandler - Thread Erişim Kontrolü Helper Metodu

**Konum:** `src/infrastructure/realtime/socket.handler.ts`

**Yapılacaklar:**
- Private helper metod ekle: `validateThreadAccess`
  - Parametreler: userId, threadId
  - MessagingService veya repository üzerinden thread'i al
  - Kullanıcının thread'de participant olduğunu kontrol et
  - True/false döndür
  - join_thread, typing_start, typing_stop gibi event'lerde kullan

**Alternatif:** Bu kontrolü MessagingService'de yapıp sadece boolean döndüren bir metod ekle

---

### 7. MessagingService - markMessageAsRead Güncelleme

**Konum:** `src/application/messaging/messaging.service.ts`

**Yapılacaklar:**
- Mevcut `markMessageAsRead` metodunda:
  - Thread room'una da `message_read` event'i gönder
  - Böylece thread açık olan gönderici de okundu bilgisini anında görür
  - Mevcut kullanıcı odasına gönderme işlemi kalabilir (fallback için)

---

## 🧪 Test Senaryoları

### Senaryo 1: Mesaj Gönderme
1. Kullanıcı A, Kullanıcı B'ye mesaj gönderir
2. Kullanıcı B thread'i açık değilse → Kendi odasına `new_message` event'i gelir
3. Kullanıcı B thread'i açıksa → Thread room'undan `new_message` event'i gelir
4. Kullanıcı A thread'i açıksa → Thread room'undan mesajı görür

### Senaryo 2: Thread'e Katılma
1. Kullanıcı A thread sayfasını açar
2. Frontend `join_thread` event'i gönderir
3. Backend thread room'una ekler
4. Kullanıcı A artık thread room'undaki mesajları dinler

### Senaryo 3: Typing Indicator
1. Kullanıcı A thread'de yazmaya başlar
2. Frontend `typing_start` event'i gönderir
3. Kullanıcı B (thread açıksa) `user_typing` event'i alır
4. Kullanıcı A yazmayı bırakır
5. Frontend `typing_stop` event'i gönderir
6. Kullanıcı B `user_typing` event'i alır (isTyping: false)

### Senaryo 4: Mesaj Okundu
1. Kullanıcı B mesajı okur
2. Backend `markMessageAsRead` çağrılır
3. Thread room'una `message_read` event'i gönderilir
4. Kullanıcı A thread açıksa okundu bilgisini anında görür

---

## 📊 Öncelik Sırası

### Faz 1 (Minimum Viable - Yüksek Öncelik)
1. ✅ `sendDirectMessage`'a socket bildirimi ekle
2. ✅ Thread room yönetimi ekle
3. ✅ `join_thread` / `leave_thread` event handler'ları ekle
4. ✅ Event payload interface'leri oluştur

### Faz 2 (İyileştirmeler - Orta Öncelik)
5. ⚠️ Typing indicator event'leri ekle
6. ⚠️ Thread erişim kontrolü ekle
7. ⚠️ `markMessageAsRead`'i thread room ile güncelle

### Faz 3 (Opsiyonel - Düşük Öncelik)
8. 🔵 Online/offline status
9. 🔵 Typing debounce/throttle
10. 🔵 Frontend dokümantasyonu

---

## ⚠️ Dikkat Edilmesi Gerekenler

1. **Thread Erişim Kontrolü:** Her thread event'inde kullanıcının thread'e erişim yetkisi kontrol edilmeli
2. **Hata Yönetimi:** Socket işlemlerinde try-catch kullan, hata durumunda log'la ama uygulamayı çökertme
3. **Logging:** Tüm socket event'leri Winston logger ile log'lanmalı
4. **Performance:** Thread room'ları gereksiz yere büyümemeli, kullanıcı thread'den ayrıldığında `leave_thread` çağrılmalı
5. **Consistency:** Mevcut `markMessageAsRead`'deki socket kullanımı ile tutarlı olmalı

---

## 🔌 Frontend ile Koordinasyon

### Frontend'in Dinlemesi Gereken Event'ler:

#### `new_message`
Yeni mesaj geldiğinde tetiklenir.
```typescript
{
  messageId: number;
  threadId: number;
  senderId: string;
  recipientId: string;
  message: string;
  messageType: 'TEXT' | 'TIPS' | 'SYSTEM';
  timestamp: string;
}
```

#### `message_read`
Mesaj okunduğunda tetiklenir.
```typescript
{
  messageId: number;
  threadId: number;
  readBy: string;
  timestamp: string;
}
```

#### `user_typing`
Kullanıcı yazıyor/yazmayı bıraktığında tetiklenir.
```typescript
{
  userId: string;
  threadId: string;
  isTyping: boolean;
}
```

#### `message_sent` (Opsiyonel)
Mesaj gönderildi onayı için.
```typescript
{
  messageId: number;
  threadId: number;
  recipientId: string;
  timestamp: string;
}
```

### Frontend'in Göndermesi Gereken Event'ler:

#### `join_thread`
Thread sayfası açıldığında gönderilmeli.
```typescript
socket.emit('join_thread', threadId);
```

#### `leave_thread`
Thread sayfası kapatıldığında gönderilmeli.
```typescript
socket.emit('leave_thread', threadId);
```

#### `typing_start`
Input'a yazmaya başladığında gönderilmeli.
```typescript
socket.emit('typing_start', { threadId });
```

#### `typing_stop`
Input'tan focus çıktığında veya belirli süre yazılmadığında gönderilmeli.
```typescript
socket.emit('typing_stop', { threadId });
```

---

## 📁 Dosya Yapısı

```
src/
├── infrastructure/
│   └── realtime/
│       ├── socket.handler.ts          (güncellenecek)
│       ├── socket-manager.ts          (mevcut - değişiklik yok)
│       └── messaging-events.ts        (yeni - event interface'leri)
├── application/
│   └── messaging/
│       └── messaging.service.ts       (güncellenecek)
└── interfaces/
    └── messaging/
        └── messaging.router.ts        (mevcut - değişiklik yok)
```

---

## 🎯 Sonuç

Bu akış ile:
- ✅ Mevcut Socket.IO altyapısı kullanılır
- ✅ Redis adapter ile scaling desteklenir
- ✅ Ek Redis PubSub gerekmez
- ✅ Frontend ile doğrudan iletişim sağlanır
- ✅ Thread bazlı real-time mesajlaşma çalışır

**Önerilen Yaklaşım:** İlk fazı tamamladıktan sonra test edip, gerekirse ikinci faza geçilebilir.

---

## 📝 Notlar

- Tüm socket event'leri Winston logger ile log'lanmalı
- Hata durumlarında graceful degradation sağlanmalı (socket hatası uygulamayı çökertmemeli)
- Thread erişim kontrolü güvenlik için kritik
- Performance için gereksiz room'lardan çıkış yapılmalı

---

**Dokümantasyon Tarihi:** 2024
**Versiyon:** 1.0
**Durum:** Planlama Aşaması

