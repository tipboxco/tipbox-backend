# Notification System - Test Rehberi

## 🧪 Test Hazırlığı

### 1. Branch Kontrolü
```bash
git branch  # feat/notification-system olmalı
git log --oneline -3  # Son commit'leri kontrol et
```

### 2. Docker Container'ları Başlat
```bash
# Docker container'ları başlat (PostgreSQL, Redis, etc.)
npm run docker:up

# Ya da
docker-compose up -d
```

### 3. Database Güncellemesi
```bash
# Development database'i güncelle (Docker içinde)
npm run db:push

# Prisma client'ı regenerate et (Docker içinde)
npm run db:generate

# Migration durumunu kontrol et
npm run db:status
```

### 4. Build Kontrolü
```bash
# Docker container içinde build
docker-compose exec backend npm run build

# Ya da local'de (TypeScript kontrolü için)
npm run build
```

### 5. Backend Logs İzleme
```bash
# Backend container logs'larını izle
docker-compose logs -f backend

# Ya da
docker logs -f tipbox_backend
```

## 📱 Manuel Test Senaryoları

### Test 1: Push Token Kaydı

**API Call:**
```bash
POST http://localhost:3000/notifications/push-token
Headers:
  Authorization: Bearer YOUR_JWT_TOKEN
  Content-Type: application/json
Body:
{
  "token": "ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]",
  "deviceType": "ios"
}
```

**Beklenen Sonuç:**
```json
{
  "success": true,
  "message": "Push token registered successfully",
  "data": {
    "id": "...",
    "userId": "...",
    "token": "ExponentPushToken[...]",
    "deviceType": "ios",
    "isActive": true
  }
}
```

### Test 2: Notification Settings Güncelleme

**API Call:**
```bash
PUT http://localhost:3000/notifications/settings
Headers:
  Authorization: Bearer YOUR_JWT_TOKEN
  Content-Type: application/json
Body:
{
  "postNotifications": true,
  "messageNotifications": false,
  "trustNotifications": true,
  "notificationPushEnabled": true
}
```

**Beklenen Sonuç:**
```json
{
  "success": true,
  "message": "Notification settings updated"
}
```

### Test 3: Post Like Bildirimi

**Senaryo:**
1. Kullanıcı A bir post oluşturur
2. Kullanıcı B bu post'u beğenir
3. Kullanıcı A bildirim almalı

**API Call:**
```bash
POST http://localhost:3000/interactions/posts/{postId}/like
Headers:
  Authorization: Bearer USER_B_JWT_TOKEN
```

**Kontroller:**
- ✅ Socket.IO ile realtime bildirim
- ✅ Database'e notification kaydı
- ✅ Expo push notification gönderildi mi (log'lardan kontrol)

**Verification:**
```bash
GET http://localhost:3000/notifications
Headers:
  Authorization: Bearer USER_A_JWT_TOKEN
```

**Beklenen Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "...",
      "type": "POST_LIKED",
      "title": "Postunuz Beğenildi! ❤️",
      "message": "User B postunuzu beğendi",
      "read": false,
      "createdAt": "..."
    }
  ]
}
```

### Test 4: Comment Bildirimi

**Senaryo:**
1. Kullanıcı A bir post'a yorum yapar
2. Post sahibi bildirim almalı

**API Call:**
```bash
POST http://localhost:3000/interactions/posts/{postId}/comments
Headers:
  Authorization: Bearer USER_A_JWT_TOKEN
Body:
{
  "content": "Harika bir paylaşım!"
}
```

### Test 5: DM Mesaj Bildirimi

**Senaryo:**
1. Kullanıcı A, Kullanıcı B'ye mesaj gönderir
2. Kullanıcı B NEW_MESSAGE bildirimi almalı

**API Call:**
```bash
POST http://localhost:3000/messages/send
Headers:
  Authorization: Bearer USER_A_JWT_TOKEN
Body:
{
  "recipientId": "USER_B_ID",
  "message": "Merhaba!"
}
```

### Test 6: Badge Kazanma Bildirimi

**API Call:**
```bash
# Gamification servisi üzerinden badge ver
# (Bu genellikle sistem tarafından otomatik verilir)
```

**Manuel Test için:**
```typescript
// Docker container içinde Node.js console:
docker-compose exec backend node
> const { GamificationService } = require('./dist/application/gamification/gamification.service');
> const gamificationService = new GamificationService();
> await gamificationService.grantBadgeToUser('USER_ID', 'BADGE_ID');
```

### Test 7: Okundu İşaretleme

**API Call:**
```bash
PUT http://localhost:3000/notifications/{notificationId}/read
Headers:
  Authorization: Bearer YOUR_JWT_TOKEN
```

**Beklenen:**
- Notification'ın `read: true` olması
- `readAt` timestamp'inin set edilmesi

### Test 8: Tüm Bildirimleri Okundu İşaretle

**API Call:**
```bash
PUT http://localhost:3000/notifications/mark-all-read
Headers:
  Authorization: Bearer YOUR_JWT_TOKEN
```

**Beklenen Response:**
```json
{
  "success": true,
  "message": "5 notifications marked as read",
  "data": {
    "count": 5
  }
}
```

### Test 9: Okunmamış Bildirim Sayısı

**API Call:**
```bash
GET http://localhost:3000/notifications/unread-count
Headers:
  Authorization: Bearer YOUR_JWT_TOKEN
```

**Beklenen Response:**
```json
{
  "success": true,
  "data": {
    "count": 3
  }
}
```

### Test 10: Notification Settings Getir

**API Call:**
```bash
GET http://localhost:3000/notifications/settings
Headers:
  Authorization: Bearer YOUR_JWT_TOKEN
```

**Beklenen Response:**
```json
{
  "success": true,
  "data": {
    "trustNotifications": true,
    "supportNotifications": true,
    "messageNotifications": true,
    "collectionNotifications": true,
    "postNotifications": true,
    "notificationEmailEnabled": true,
    "notificationPushEnabled": true,
    "notificationInAppEnabled": true
  }
}
```

## 🔍 Log Kontrolü

### Backend Container Logs
```bash
# Tüm backend logs'larını izle
docker-compose logs -f backend

# Sadece notification ile ilgili logs
docker-compose logs -f backend | grep -i notification

# Son 100 satır
docker-compose logs --tail=100 backend
```

### Worker Logs
```bash
# Worker logs'larını izle (backend container içinde çalışıyor)
docker-compose logs -f backend | grep -i "notification worker"
```

**Beklenen log örnekleri:**
```
[INFO] Notification queued for user abc123: POST_LIKED
[INFO] Processing notification: POST_LIKED for user abc123
[INFO] Notification POST_LIKED processed successfully for user abc123
[INFO] Push notifications sent to user abc123 (1 devices)
```

### Database Kontrolü
```bash
# Prisma Studio'yu başlat (Docker container üzerinden)
docker-compose exec backend npx prisma studio

# Browser'da: http://localhost:5555
```

**Kontrol edilecekler:**
- `notifications` tablosunda kayıtlar var mı?
- `push_tokens` tablosunda tokenlar kayıtlı mı?
- `user_settings` tablosunda yeni kolonlar var mı?

## 🐛 Debugging

### Socket.IO Bağlantı Kontrolü
```javascript
// Frontend'de
socket.on('connect', () => {
  console.log('Socket connected:', socket.id);
});

socket.on('notification', (data) => {
  console.log('Received notification:', data);
});
```

### Queue Kontrolü (Redis)
```bash
# Redis container'a bağlan
docker-compose exec redis redis-cli

# Queue'ları listele
> KEYS bull:notifications:*

# Queue uzunluğunu kontrol et
> LLEN bull:notifications:wait

# Queue'daki işleri görüntüle
> LRANGE bull:notifications:wait 0 -1

# Redis'i temizle (dikkatli!)
> FLUSHALL
```

### PostgreSQL Database Kontrolü
```bash
# PostgreSQL container'a bağlan
docker-compose exec postgres psql -U postgres -d tipbox_dev

# Notification tablolarını kontrol et
\dt notifications
\dt push_tokens

# Kayıt sayılarını kontrol et
SELECT COUNT(*) FROM notifications;
SELECT COUNT(*) FROM push_tokens;
SELECT * FROM notifications ORDER BY created_at DESC LIMIT 5;

# Çıkış
\q
```

### Expo Push Token Doğrulama
```bash
# Backend container içinde Node.js konsolu
docker-compose exec backend node

# Token doğrulama
> const { Expo } = require('expo-server-sdk');
> const expo = new Expo();
> console.log(expo.isExpoPushToken('ExponentPushToken[xxxxxx]'));
// true dönmeli
```

### Container Durumu Kontrolü
```bash
# Tüm container'ların durumunu kontrol et
docker-compose ps

# Backend container'ın sağlık durumu
docker inspect tipbox_backend --format='{{.State.Health.Status}}'

# Backend container içine gir
docker-compose exec backend sh
```

## ✅ Test Checklist

### Bildirim Tipleri
- [ ] POST_LIKED
- [ ] POST_COMMENTED
- [ ] POST_SHARED
- [ ] POST_FAVORITED
- [ ] COMMENT_LIKED
- [ ] COMMENT_REPLIED
- [ ] NEW_TRUSTER
- [ ] NEW_MESSAGE
- [ ] DM_REQUEST_RECEIVED
- [ ] NEW_BADGE
- [ ] ACHIEVEMENT_UNLOCKED
- [ ] EXPERT_REQUEST_AVAILABLE

### API Endpoints
- [ ] GET /notifications
- [ ] GET /notifications/unread-count
- [ ] PUT /notifications/:id/read
- [ ] PUT /notifications/mark-all-read
- [ ] DELETE /notifications/:id
- [ ] GET /notifications/settings
- [ ] PUT /notifications/settings
- [ ] POST /notifications/push-token
- [ ] DELETE /notifications/push-token

### Kanallar
- [ ] Socket.IO (realtime)
- [ ] Expo Push (mobile)
- [ ] Database kayıt

### Settings
- [ ] postNotifications kontrol ediliyor mu?
- [ ] messageNotifications kontrol ediliyor mu?
- [ ] notificationPushEnabled kontrol ediliyor mu?

## 🚀 Production Deployment Öncesi

### Pre-deployment Checklist
- [ ] Tüm testler başarılı
- [ ] Build hatasız
- [ ] Migration hazır
- [ ] Environment variables set (.env.production)
- [ ] Expo Access Token set (production için)
- [ ] Frontend integration tamamlandı
- [ ] Documentation güncel

### Environment Variables
```env
# .env.production
EXPO_ACCESS_TOKEN=your_production_expo_token
DATABASE_URL=production_database_url
REDIS_URL=production_redis_url
```

## 📊 Performance Testing

### Load Test
```bash
# Apache Bench ile test (Docker dışından)
ab -n 1000 -c 10 http://localhost:3000/notifications/

# k6 ile test
docker run --rm -i grafana/k6 run - <script.js
```

### Queue Performance
```bash
# BullMQ dashboard (eğer eklemişseniz)
# http://localhost:3000/admin/queues

# Redis'ten queue metriklerini kontrol et
docker-compose exec redis redis-cli
> INFO stats
> SLOWLOG get 10
```

## 🔗 Faydalı Docker Komutları

```bash
# Container'ları yeniden başlat
docker-compose restart backend

# Container'ları durdur
docker-compose stop

# Container'ları sil ve yeniden oluştur
docker-compose down
docker-compose up -d

# Backend container'ı rebuild et
docker-compose up -d --build backend

# Container logs'larını temizle
docker-compose down
docker system prune -f

# Backend container içinde komut çalıştır
docker-compose exec backend npm run build
docker-compose exec backend npx prisma studio
docker-compose exec backend npm run db:seed

# Database'i sıfırla (development)
npm run db:reset

# Prisma Studio aç
npm run db:generate  # 5555 portunda açılır

# Redis'i temizle (development)
docker-compose exec redis redis-cli FLUSHALL

# PostgreSQL backup al
docker-compose exec postgres pg_dump -U postgres tipbox_dev > backup.sql

# Git durumu
git status
git log --oneline
```

## 🔧 Troubleshooting

### Problem: Container başlamıyor
```bash
# Container logs'larını kontrol et
docker-compose logs backend

# Container'ı rebuild et
docker-compose up -d --build backend
```

### Problem: Database bağlantı hatası
```bash
# PostgreSQL container'ın çalıştığını kontrol et
docker-compose ps postgres

# Database connection string'i kontrol et
docker-compose exec backend printenv | grep DATABASE_URL

# PostgreSQL'e manuel bağlan
docker-compose exec postgres psql -U postgres -d tipbox_dev
```

### Problem: Redis bağlantı hatası
```bash
# Redis container'ın çalıştığını kontrol et
docker-compose ps redis

# Redis'e bağlanabilir misiniz?
docker-compose exec redis redis-cli ping
# PONG dönmeli
```

### Problem: Notification worker çalışmıyor
```bash
# Worker logs'larını kontrol et
docker-compose logs backend | grep -i worker

# Backend container'ı restart et
docker-compose restart backend

# Worker process'ini kontrol et
docker-compose exec backend ps aux | grep node
```

### Problem: Port çakışması
```bash
# Kullanılan portları kontrol et
lsof -i :3000  # Backend port
lsof -i :5432  # PostgreSQL port
lsof -i :6379  # Redis port
lsof -i :5555  # Prisma Studio port

# Docker'ı restart et
docker-compose down
docker-compose up -d
```

---

**Test Tarihi:** 30 Aralık 2025  
**Branch:** feat/notification-system  
**Versiyon:** 1.0.0  
**Docker Compose Version:** Compatible with project setup

