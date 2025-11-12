# Socket.IO Test Rehberi

Bu dokümantasyon, mesajlaşma socket bağlantılarını test etmek için kullanabileceğiniz araçları ve yöntemleri açıklar.

## Test Araçları

### 1. HTML Test Sayfası (Önerilen - En Kolay)

**Dosya:** `test-socket.html`

**Kullanım:**
1. Tarayıcıda `test-socket.html` dosyasını açın
2. JWT token'ınızı girin (login endpoint'inden alın)
3. "Bağlan" butonuna tıklayın
4. Thread ID girip thread'e katılın
5. Mesaj gönderin ve event'leri canlı izleyin

**Özellikler:**
- ✅ Görsel arayüz
- ✅ Tüm event'leri canlı görüntüleme
- ✅ Mesaj gönderme (REST API)
- ✅ Thread yönetimi
- ✅ Typing indicator testi
- ✅ Event log'u

### 2. Node.js Test Scripti

**Dosya:** `test-socket.js`

**Kurulum:**
```bash
npm install socket.io-client
```

**Kullanım:**
```bash
# JWT token'ınızı alın (login endpoint'inden)
node test-socket.js "YOUR_JWT_TOKEN" http://localhost:3000
```

**Komutlar:**
- `join <threadId>` - Thread'e katıl
- `leave <threadId>` - Thread'den ayrıl
- `typing_start <threadId>` - Yazma göstergesi başlat
- `typing_stop <threadId>` - Yazma göstergesi durdur
- `ping` - Ping gönder
- `quit` - Çıkış

### 3. Browser Console (Hızlı Test)

Tarayıcı console'unda direkt test edebilirsiniz:

```javascript
// Socket.IO client CDN'i yükleyin (eğer yoksa)
// <script src="https://cdn.socket.io/4.5.4/socket.io.min.js"></script>

const socket = io('http://localhost:3000', {
  auth: {
    token: 'YOUR_JWT_TOKEN'
  }
});

// Event dinleyicileri
socket.on('connect', () => console.log('✅ Bağlandı'));
socket.on('new_message', (data) => console.log('📨 Yeni mesaj:', data));
socket.on('message_read', (data) => console.log('👁️ Okundu:', data));
socket.on('user_typing', (data) => console.log('⌨️ Yazıyor:', data));

// Thread'e katıl
socket.emit('join_thread', 'THREAD_ID');

// Yazma göstergesi
socket.emit('typing_start', { threadId: 'THREAD_ID' });
```

## Test Senaryoları

### Senaryo 1: İki Kullanıcı ile Mesajlaşma

1. **İki farklı tarayıcı/sekme açın** (veya iki farklı JWT token kullanın)
2. Her ikisinde de `test-socket.html` açın
3. Her ikisinde de farklı kullanıcı token'ları ile bağlanın
4. Bir kullanıcı thread ID'yi alın (mesaj göndererek thread oluşturun)
5. Her iki kullanıcı da aynı thread'e katılın
6. Bir kullanıcı mesaj gönderin
7. Diğer kullanıcıda `new_message` event'ini görmelisiniz

### Senaryo 2: Thread Odası Testi

1. Kullanıcı A thread'e katılır (`join_thread`)
2. Kullanıcı B thread'e katılır
3. Kullanıcı A mesaj gönderir
4. Her iki kullanıcı da `new_message` event'ini almalı (thread odasından)
5. Kullanıcı A thread'den ayrılır (`leave_thread`)
6. Kullanıcı B mesaj gönderir
7. Kullanıcı A sadece kendi odasından (`user:{userId}`) bildirim almalı

### Senaryo 3: Typing Indicator

1. İki kullanıcı aynı thread'de
2. Kullanıcı A `typing_start` gönderir
3. Kullanıcı B `user_typing` event'ini almalı (`isTyping: true`)
4. Kullanıcı A `typing_stop` gönderir
5. Kullanıcı B `user_typing` event'ini almalı (`isTyping: false`)

### Senaryo 4: Okundu Bilgisi

1. Kullanıcı A mesaj gönderir
2. Kullanıcı B mesajı okur (REST API: `POST /messages/{messageId}/read`)
3. Kullanıcı A `message_read` event'ini almalı
4. Eğer her iki kullanıcı da thread'deyse, thread odasından event gelir

### Senaryo 5: Presence (Online/Offline)

1. Kullanıcı A bağlanır
2. Tüm client'lar `user_presence` event'ini almalı (`status: 'online'`)
3. Kullanıcı A bağlantıyı keser
4. Tüm client'lar `user_presence` event'ini almalı (`status: 'offline'`)

## REST API ile Mesaj Gönderme

Socket event'lerini tetiklemek için REST endpoint'lerini kullanabilirsiniz:

```bash
# Mesaj gönder
curl -X POST http://localhost:3000/messages \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "recipientId": "USER_ID",
    "message": "Test mesajı"
  }'

# Mesajı okundu olarak işaretle
curl -X POST http://localhost:3000/messages/MESSAGE_ID/read \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# TIPS gönder
curl -X POST http://localhost:3000/messages/tips \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "recipientId": "USER_ID",
    "amount": 100,
    "message": "Teşekkürler!"
  }'
```

## Beklenen Event'ler

### Gelen Event'ler (Backend'den)

| Event | Ne Zaman | Payload |
|-------|----------|---------|
| `connected` | Bağlantı kurulduğunda | `{ message, userId, userEmail }` |
| `new_message` | Yeni mesaj geldiğinde | `NewMessageEvent` |
| `message_sent` | Mesaj gönderildiğinde (onay) | `MessageSentEvent` |
| `message_read` | Mesaj okunduğunda | `MessageReadEvent` |
| `user_typing` | Kullanıcı yazıyor/yazmayı durdurdu | `TypingEvent` |
| `user_presence` | Kullanıcı online/offline oldu | `PresenceEvent` |
| `thread_joined` | Thread'e katıldığınızda | `{ threadId }` |
| `thread_left` | Thread'den ayrıldığınızda | `{ threadId }` |
| `thread_join_error` | Thread'e katılma hatası | `{ threadId, reason }` |

### Gönderilen Event'ler (Client'tan)

| Event | Ne Zaman | Payload |
|-------|----------|---------|
| `join_thread` | Thread sayfası açıldığında | `threadId` (string) |
| `leave_thread` | Thread sayfası kapatıldığında | `threadId` (string) |
| `typing_start` | Yazmaya başladığında | `{ threadId }` |
| `typing_stop` | Yazmayı durdurduğunda | `{ threadId }` |
| `ping` | Heartbeat için | - |

## Sorun Giderme

### "Authentication token required" hatası
- JWT token'ınızı kontrol edin
- Token'ın geçerli olduğundan emin olun (login endpoint'inden yeni token alın)

### "Thread join error: unauthorized"
- Thread ID'nin doğru olduğundan emin olun
- Kullanıcının thread'e erişim yetkisi olduğundan emin olun (thread participant'ı olmalı)

### Event'ler gelmiyor
- Socket bağlantısının aktif olduğundan emin olun (`connect` event'i geldi mi?)
- Thread'e katıldınız mı? (`join_thread` gönderdiniz mi?)
- Server log'larını kontrol edin

### CORS hatası
- `.env` dosyasında `CORS_ORIGINS` ayarını kontrol edin
- Test sayfasını açtığınız URL'in CORS listesinde olduğundan emin olun

## Debug İpuçları

1. **Server log'larını izleyin:**
   ```bash
   docker logs -f tipbox_backend
   ```

2. **Socket bağlantı durumunu kontrol edin:**
   - Browser console'da `socket.connected` değerini kontrol edin
   - `socket.id` ile socket ID'yi görebilirsiniz

3. **Event'leri manuel dinleyin:**
   ```javascript
   socket.onAny((event, ...args) => {
     console.log('Event:', event, args);
   });
   ```

4. **Redis adapter durumunu kontrol edin:**
   - Redis'in çalıştığından emin olun
   - Birden fazla server instance'ı varsa, Redis adapter sayesinde event'ler tüm instance'lara yayılır


