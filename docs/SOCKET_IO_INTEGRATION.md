# Socket.IO Entegrasyonu

Bu dokümantasyon, TipBox backend projesine eklenen Socket.IO entegrasyonunun nasıl çalıştığını ve nasıl kullanılacağını açıklar.

## Kurulum ve Yapılandırma

### 1. NPM Paketleri
Aşağıdaki paketler `package.json` dosyasına eklenmiştir:
- `socket.io`: WebSocket sunucusu
- `redis`: Redis client
- `@socket.io/redis-adapter`: Redis adapter for Socket.IO

### 2. Docker Compose
`docker-compose.yml` dosyasına Redis servisi eklenmiştir:
```yaml
redis:
  image: redis:latest
  container_name: tipbox_redis
  restart: always
  ports:
    - "6379:6379"
  volumes:
    - redis_data:/data
  command: redis-server --appendonly yes
```

### 3. Environment Variables
`.env` dosyasına aşağıdaki değişkenler eklenmelidir:
```env
REDIS_URL=redis://localhost:6379
CORS_ORIGINS=http://localhost:3000,https://your-frontend-domain.com
CORS_METHODS=GET,POST,PUT,DELETE,OPTIONS
```

## Mimari

### Konfigürasyon Katmanı
- `src/infrastructure/config/redis.config.ts`: Redis bağlantı yönetimi
- `src/infrastructure/config/socket.config.ts`: Socket.IO CORS ve transport ayarları

### Realtime Katmanı
- `src/infrastructure/realtime/socket.handler.ts`: Socket bağlantı yönetimi ve kimlik doğrulama
- `src/infrastructure/realtime/socket-manager.ts`: Global SocketHandler erişimi için singleton pattern

### Application Katmanı
- `src/application/interaction/interaction.service.ts`: Beğeni, favori gibi etkileşimler için Socket bildirimleri
- `src/application/messaging/messaging.service.ts`: Anlık mesajlaşma için Socket entegrasyonu

## Kullanım

### 1. Sunucu Başlatma
Sunucu başlatıldığında Socket.IO otomatik olarak kurulur ve Redis adapter ile yapılandırılır.

### 2. Client Bağlantısı
Client tarafında Socket.IO bağlantısı kurulurken JWT token gönderilmelidir:

```javascript
import { io } from 'socket.io-client';

const socket = io('http://localhost:3000', {
  auth: {
    token: 'your-jwt-token'
  }
});
```

### 3. Kimlik Doğrulama
Her bağlantı kurulduğunda:
1. Client'tan JWT token alınır
2. Token doğrulanır
3. Kullanıcı bilgileri socket.data'ya eklenir
4. Kullanıcı kendi özel odasına katılır

### 4. Bildirim Gönderme

#### Belirli Kullanıcıya Bildirim
```typescript
import SocketManager from '../infrastructure/realtime/socket-manager';

// Kullanıcıya bildirim gönder
SocketManager.getInstance().getSocketHandler().sendMessageToUser(
  userId,
  'new_notification',
  {
    type: 'post_liked',
    message: 'Gönderiniz beğenildi',
    timestamp: new Date().toISOString()
  }
);
```

#### Tüm Kullanıcılara Yayın
```typescript
// Tüm bağlı kullanıcılara yayın
SocketManager.getInstance().getSocketHandler().broadcast(
  'system_announcement',
  {
    message: 'Sistem bakımı yapılacak',
    timestamp: new Date().toISOString()
  }
);
```

#### Belirli Odaya Mesaj
```typescript
// Belirli bir odaya mesaj gönder
SocketManager.getInstance().getSocketHandler().sendToRoom(
  'room_name',
  'room_message',
  {
    message: 'Oda mesajı',
    timestamp: new Date().toISOString()
  }
);
```

## Event Türleri

### Client'tan Sunucuya
- `ping`: Heartbeat kontrolü
- `disconnect`: Bağlantı kesilme

### Sunucudan Client'a
- `connected`: Başarılı bağlantı onayı
- `pong`: Ping yanıtı
- `new_notification`: Yeni bildirim
- `new_message`: Yeni mesaj
- `message_sent`: Mesaj gönderilme onayı
- `message_read`: Mesaj okundu bildirimi

## Örnek Kullanım Senaryoları

### 1. Post Beğenme
```typescript
// InteractionService içinde
async likePost(userId: number, postId: number): Promise<ContentLike> {
  // Beğeniyi veritabanına kaydet
  const like = await this.contentLikeRepo.create({...});
  
  // Post sahibine bildirim gönder
  SocketManager.getInstance().getSocketHandler().sendMessageToUser(
    post.authorId.toString(),
    'new_notification',
    {
      type: 'post_liked',
      message: `${liker.name} gönderinizi beğendi.`,
      postId: post.id,
      timestamp: new Date().toISOString()
    }
  );
  
  return like;
}
```

### 2. Anlık Mesajlaşma
```typescript
// MessagingService içinde
async sendMessage(data: SendMessageData): Promise<DmMessage> {
  // Mesajı veritabanına kaydet
  const message = await this.dmMessageRepo.create({...});
  
  // Alıcıya anlık mesaj gönder
  SocketManager.getInstance().getSocketHandler().sendMessageToUser(
    data.recipientId.toString(),
    'new_message',
    {
      messageId: message.id,
      senderId: message.senderId,
      content: message.content,
      timestamp: message.createdAt.toISOString()
    }
  );
  
  return message;
}
```

## Güvenlik

- Tüm Socket bağlantıları JWT token ile doğrulanır
- Kullanıcılar sadece kendi özel odalarına erişebilir
- CORS ayarları environment variable'lardan okunur
- Redis adapter ile horizontal scaling desteklenir

## Monitoring ve Logging

- Tüm Socket bağlantıları Winston logger ile loglanır
- Bağlantı, bağlantı kesilme ve hata durumları takip edilir
- Redis bağlantı durumu monitör edilir

## Scaling

Redis adapter sayesinde birden fazla sunucu instance'ı arasında Socket.IO mesajları senkronize edilir. Bu sayede:
- Load balancer arkasında birden fazla sunucu çalıştırılabilir
- Tüm kullanıcılara mesaj gönderilebilir
- Room-based mesajlaşma çalışır
