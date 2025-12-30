# Notification System - Test Rehberi

## 🧪 Test Hazırlığı

### 1. Branch Kontrolü
```bash
git branch  # feat/notification-system olmalı
git log --oneline -3  # Son commit'leri kontrol et
```

### 2. Database Güncellemesi
```bash
# Development database'i güncelle
npm run db:push

# Prisma client'ı regenerate et
npx prisma generate
```

### 3. Build Kontrolü
```bash
npm run build  # Hata olmamalı
```

### 4. Server Başlatma
```bash
# Docker container'ları başlat
npm run docker:up

# Backend server'ı başlat
npm run dev
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
// Backend console'da:
const gamificationService = new GamificationService();
await gamificationService.grantBadgeToUser('USER_ID', 'BADGE_ID');
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

### Worker Logs
```bash
# Terminal'de worker log'larını izle
tail -f logs/2025-12-30.log | grep -i notification
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
# Prisma Studio ile database'i kontrol et
npx prisma studio
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

### Queue Kontrolü
```bash
# BullMQ dashboard (eğer kuruluysa)
# http://localhost:3000/admin/queues

# Ya da Redis'ten queue'yu kontrol et
redis-cli
> KEYS bull:notifications:*
> LLEN bull:notifications:wait
```

### Expo Push Token Doğrulama
```javascript
// Backend'de
import { Expo } from 'expo-server-sdk';

const expo = new Expo();
console.log(expo.isExpoPushToken('ExponentPushToken[xxxxxx]'));
// true dönmeli
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
# Çok sayıda bildirim gönder
# Apache Bench veya k6 ile test et
ab -n 1000 -c 10 http://localhost:3000/notifications/
```

### Queue Performance
```bash
# Worker'ın kaç saniyede kaç bildirim işlediğini kontrol et
# Log'lardan calculation yap
```

## 🔗 Faydalı Komutlar

```bash
# Worker'ı restart et
pm2 restart notification-worker

# Redis'i temizle (development)
redis-cli FLUSHALL

# Database'i sıfırla (development)
npm run db:reset

# Prisma Studio aç
npx prisma studio

# Log'ları izle
tail -f logs/*.log

# Git durumu
git status
git log --oneline
```

---

**Test Tarihi:** 30 Aralık 2025  
**Branch:** feat/notification-system  
**Versiyon:** 1.0.0

