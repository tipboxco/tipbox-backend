# Bildirim Formatı ve Mobil Yönlendirme Rehberi

Bu doküman, backend'den gönderilen bildirimlerin formatını ve mobil uygulamanın bu bildirimleri nasıl kullanarak kullanıcıları ilgili ekranlara yönlendireceğini açıklar.

## 📋 İçindekiler

1. [Bildirim Formatı](#bildirim-formatı)
2. [Yönlendirme Yapısı](#yönlendirme-yapısı)
3. [Bildirim Tipleri ve Yönlendirme Haritası](#bildirim-tipleri-ve-yönlendirme-haritası)
4. [API Endpoint'leri](#api-endpointleri)
5. [Real-time Bildirimler (Socket.IO)](#real-time-bildirimler-socketio)
6. [Push Bildirimler (Expo)](#push-bildirimler-expo)
7. [Mobil Uygulama Entegrasyonu](#mobil-uygulama-entegrasyonu)

---

## 📨 Bildirim Formatı

### API Response Formatı

**Endpoint:** `GET /notifications`

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "18ae0237-e5c2-428f-b873-684e32169cd5",
      "userId": "480f5de9-b691-4d70-a6a8-2789226f4e07",
      "type": "POST_LIKED",
      "title": "Postunuz Beğenildi! ❤️",
      "message": "Alice postunuzu beğendi",
      "data": {
        "likerName": "Alice",
        "likerId": "aa53784b-a051-4400-8e4d-9136a0d54f07",
        "postId": "01KDX9PH65T0N02AEDJEME16SM",
        "navigation": {
          "screen": "PostDetail",
          "postId": "01KDX9PH65T0N02AEDJEME16SM"
        }
      },
      "read": false,
      "readAt": null,
      "createdAt": "2024-01-15T10:30:00.000Z",
      "updatedAt": "2024-01-15T10:30:00.000Z"
    }
  ]
}
```

### Bildirim Objesi Alanları

| Alan | Tip | Açıklama |
|------|-----|----------|
| `id` | `string (UUID)` | Bildirim benzersiz ID'si |
| `userId` | `string (UUID)` | Bildirimin gönderildiği kullanıcı ID'si |
| `type` | `NotificationType` | Bildirim tipi (enum) |
| `title` | `string` | Bildirim başlığı |
| `message` | `string` | Bildirim mesajı |
| `data` | `object` | Bildirim verisi (navigation dahil) |
| `read` | `boolean` | Okundu mu? |
| `readAt` | `string (ISO 8601)` | Okunma zamanı (null if unread) |
| `createdAt` | `string (ISO 8601)` | Oluşturulma zamanı |
| `updatedAt` | `string (ISO 8601)` | Güncellenme zamanı |

### `data` Objesi Yapısı

`data` objesi her bildirim tipine göre farklı alanlar içerir, ancak **her zaman** `navigation` alanı bulunur:

```typescript
{
  // Bildirim tipine özel alanlar
  likerName?: string;
  likerId?: string;
  commenterName?: string;
  postId?: string;
  threadId?: string;
  userId?: string;
  // ... diğer alanlar
  
  // Her zaman mevcut: Yönlendirme bilgisi
  navigation: {
    screen: string;      // Ekran adı
    postId?: string;     // Post ID (PostDetail için)
    userId?: string;     // User ID (Profile için)
    threadId?: string;   // Thread ID (Chat için)
    requestId?: string;  // Request ID (ExpertRequests için)
    badgeId?: string;    // Badge ID (Badges için)
    achievementId?: string; // Achievement ID (Achievements için)
  }
}
```

---

## 🧭 Yönlendirme Yapısı

### Navigation Objesi

Her bildirim `data.navigation` objesi içinde yönlendirme bilgisi taşır:

```typescript
interface NavigationData {
  screen: string;           // Hedef ekran adı
  postId?: string;         // Post detayı için
  userId?: string;         // Profil için
  threadId?: string;       // Chat için
  requestId?: string;       // Expert request için
  badgeId?: string;        // Badge detayı için
  achievementId?: string;  // Achievement detayı için
}
```

### Desteklenen Ekranlar

| Screen | Açıklama | Gerekli Parametreler |
|--------|----------|---------------------|
| `PostDetail` | Post detay ekranı | `postId` |
| `Profile` | Kullanıcı profil ekranı | `userId` |
| `Chat` | Mesajlaşma ekranı | `threadId` |
| `SupportRequests` | Destek talepleri ekranı | `requestId` (opsiyonel) |
| `Badges` | Rozetler ekranı | `badgeId` (opsiyonel) |
| `Achievements` | Başarılar ekranı | `achievementId` (opsiyonel) |
| `Wallet` | Cüzdan ekranı | - |
| `ExpertRequests` | Expert soruları ekranı | `requestId` (opsiyonel) |
| `{}` (boş) | Yönlendirme yok | - |

---

## 📱 Bildirim Tipleri ve Yönlendirme Haritası

### 1. Post Etkileşim Bildirimleri

#### POST_LIKED
```json
{
  "type": "POST_LIKED",
  "title": "Postunuz Beğenildi! ❤️",
  "message": "Alice postunuzu beğendi",
  "data": {
    "likerName": "Alice",
    "likerId": "uuid",
    "postId": "post-id",
    "navigation": {
      "screen": "PostDetail",
      "postId": "post-id"
    }
  }
}
```
**Yönlendirme:** `PostDetail` ekranına git, `postId` ile post'u göster

---

#### POST_COMMENTED
```json
{
  "type": "POST_COMMENTED",
  "title": "Yeni Yorum! 💬",
  "message": "Bob postunuza yorum yaptı",
  "data": {
    "commenterName": "Bob",
    "commenterId": "uuid",
    "postId": "post-id",
    "navigation": {
      "screen": "PostDetail",
      "postId": "post-id"
    }
  }
}
```
**Yönlendirme:** `PostDetail` ekranına git, `postId` ile post'u göster

---

#### POST_SHARED
```json
{
  "type": "POST_SHARED",
  "title": "Postunuz Paylaşıldı! 🔄",
  "message": "Charlie postunuzu paylaştı",
  "data": {
    "sharerName": "Charlie",
    "sharerId": "uuid",
    "postId": "post-id",
    "shareType": "INTERNAL_REPOST",
    "navigation": {
      "screen": "PostDetail",
      "postId": "post-id"
    }
  }
}
```
**Yönlendirme:** `PostDetail` ekranına git, `postId` ile post'u göster

---

#### POST_FAVORITED
```json
{
  "type": "POST_FAVORITED",
  "title": "Favorilere Eklendi! ⭐",
  "message": "Diana postunuzu favorilere ekledi",
  "data": {
    "userName": "Diana",
    "userId": "uuid",
    "postId": "post-id",
    "navigation": {
      "screen": "PostDetail",
      "postId": "post-id"
    }
  }
}
```
**Yönlendirme:** `PostDetail` ekranına git, `postId` ile post'u göster

---

#### COMMENT_LIKED
```json
{
  "type": "COMMENT_LIKED",
  "title": "Yorumunuz Beğenildi! 💙",
  "message": "Alice yorumunuzu beğendi",
  "data": {
    "likerName": "Alice",
    "likerId": "uuid",
    "postId": "post-id",
    "commentId": "comment-id",
    "navigation": {
      "screen": "PostDetail",
      "postId": "post-id"
    }
  }
}
```
**Yönlendirme:** `PostDetail` ekranına git, `postId` ile post'u göster (yorumu highlight et)

---

#### COMMENT_REPLIED
```json
{
  "type": "COMMENT_REPLIED",
  "title": "Yorumunuza Yanıt Verildi! 💬",
  "message": "Bob yorumunuza yanıt verdi",
  "data": {
    "replierName": "Bob",
    "replierId": "uuid",
    "postId": "post-id",
    "commentId": "comment-id",
    "navigation": {
      "screen": "PostDetail",
      "postId": "post-id"
    }
  }
}
```
**Yönlendirme:** `PostDetail` ekranına git, `postId` ile post'u göster (yorumu highlight et)

---

### 2. Trust & Follow Bildirimleri

#### NEW_TRUSTER
```json
{
  "type": "NEW_TRUSTER",
  "title": "Yeni Takipçi! 👥",
  "message": "Alice seni takip etmeye başladı",
  "data": {
    "trusterName": "Alice",
    "trusterId": "uuid",
    "navigation": {
      "screen": "Profile",
      "userId": "uuid"
    }
  }
}
```
**Yönlendirme:** `Profile` ekranına git, `userId` ile kullanıcı profilini göster

---

#### NEW_TRUSTED_BY
```json
{
  "type": "NEW_TRUSTED_BY",
  "title": "Seni Takip Ediyor! 🤝",
  "message": "Bob artık seni takip ediyor",
  "data": {
    "trustedName": "Bob",
    "trustedUserId": "uuid",
    "navigation": {
      "screen": "Profile",
      "userId": "uuid"
    }
  }
}
```
**Yönlendirme:** `Profile` ekranına git, `userId` ile kullanıcı profilini göster

---

### 3. Mesajlaşma Bildirimleri

#### NEW_MESSAGE
```json
{
  "type": "NEW_MESSAGE",
  "title": "Yeni Mesaj! 💬",
  "message": "Alice: Merhaba, nasılsın?",
  "data": {
    "senderName": "Alice",
    "senderId": "uuid",
    "threadId": "thread-id",
    "messagePreview": "Merhaba, nasılsın?",
    "navigation": {
      "screen": "Chat",
      "threadId": "thread-id"
    }
  }
}
```
**Yönlendirme:** `Chat` ekranına git, `threadId` ile thread'i aç

---

#### DM_REQUEST_RECEIVED
```json
{
  "type": "DM_REQUEST_RECEIVED",
  "title": "Yeni Destek Talebi! 🆘",
  "message": "Alice seninle iletişime geçmek istiyor",
  "data": {
    "requesterName": "Alice",
    "requesterId": "uuid",
    "requestId": "request-id",
    "navigation": {
      "screen": "SupportRequests",
      "requestId": "request-id"
    }
  }
}
```
**Yönlendirme:** `SupportRequests` ekranına git, `requestId` ile talebi göster

---

#### DM_REQUEST_ACCEPTED
```json
{
  "type": "DM_REQUEST_ACCEPTED",
  "title": "Talep Kabul Edildi! ✅",
  "message": "Bob desteğini kabul etti",
  "data": {
    "accepterName": "Bob",
    "accepterId": "uuid",
    "threadId": "thread-id",
    "navigation": {
      "screen": "Chat",
      "threadId": "thread-id"
    }
  }
}
```
**Yönlendirme:** `Chat` ekranına git, `threadId` ile thread'i aç

---

### 4. Gamification Bildirimleri

#### NEW_BADGE
```json
{
  "type": "NEW_BADGE",
  "title": "Yeni Rozet Kazandınız! 🏆",
  "message": "İlk Post rozetini kazandınız!",
  "data": {
    "badgeName": "İlk Post",
    "badgeId": "badge-id",
    "navigation": {
      "screen": "Badges",
      "badgeId": "badge-id"
    }
  }
}
```
**Yönlendirme:** `Badges` ekranına git, `badgeId` ile rozeti highlight et

---

#### ACHIEVEMENT_UNLOCKED
```json
{
  "type": "ACHIEVEMENT_UNLOCKED",
  "title": "Başarı Açıldı! 🎯",
  "message": "10 Post başarısını tamamladınız!",
  "data": {
    "achievementName": "10 Post",
    "achievementId": "achievement-id",
    "navigation": {
      "screen": "Achievements",
      "achievementId": "achievement-id"
    }
  }
}
```
**Yönlendirme:** `Achievements` ekranına git, `achievementId` ile başarıyı highlight et

---

#### REWARD_EARNED
```json
{
  "type": "REWARD_EARNED",
  "title": "Ödül Kazandınız! 🎁",
  "message": "100 TIPS kazandınız!",
  "data": {
    "amount": 100,
    "navigation": {
      "screen": "Wallet"
    }
  }
}
```
**Yönlendirme:** `Wallet` ekranına git

---

### 5. Expert Bildirimleri

#### EXPERT_REQUEST_AVAILABLE
```json
{
  "type": "EXPERT_REQUEST_AVAILABLE",
  "title": "Yeni Expert Sorusu! 💡",
  "message": "500 TIPS ödüllü yeni soru",
  "data": {
    "tipsAmount": 500,
    "requestId": "request-id",
    "navigation": {
      "screen": "ExpertRequests",
      "requestId": "request-id"
    }
  }
}
```
**Yönlendirme:** `ExpertRequests` ekranına git, `requestId` ile soruyu göster

---

#### EXPERT_REQUEST_ANSWERED
```json
{
  "type": "EXPERT_REQUEST_ANSWERED",
  "title": "Sorunuz Yanıtlandı! 💡",
  "message": "Alice sorunuzu yanıtladı",
  "data": {
    "expertName": "Alice",
    "expertId": "uuid",
    "requestId": "request-id",
    "navigation": {
      "screen": "ExpertRequests",
      "requestId": "request-id"
    }
  }
}
```
**Yönlendirme:** `ExpertRequests` ekranına git, `requestId` ile soruyu göster

---

### 6. Sistem Bildirimleri

#### SYSTEM_ANNOUNCEMENT
```json
{
  "type": "SYSTEM_ANNOUNCEMENT",
  "title": "Sistem Duyurusu",
  "message": "Yeni özellikler eklendi!",
  "data": {
    "title": "Sistem Duyurusu",
    "message": "Yeni özellikler eklendi!",
    "navigation": {}
  }
}
```
**Yönlendirme:** Yönlendirme yok (genel duyuru)

---

#### TIPS_RECEIVED
```json
{
  "type": "TIPS_RECEIVED",
  "title": "TIPS Aldınız! 💰",
  "message": "Alice size 50 TIPS gönderdi",
  "data": {
    "senderName": "Alice",
    "senderId": "uuid",
    "amount": 50,
    "navigation": {
      "screen": "Wallet"
    }
  }
}
```
**Yönlendirme:** `Wallet` ekranına git

---

## 🔌 API Endpoint'leri

### 1. Bildirimleri Listele

**Endpoint:** `GET /notifications`

**Query Parameters:**
- `limit` (number, optional, default: 20): Sayfa başına bildirim sayısı
- `offset` (number, optional, default: 0): Atlanacak bildirim sayısı
- `unreadOnly` (boolean, optional, default: false): Sadece okunmamış bildirimler

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "userId": "uuid",
      "type": "POST_LIKED",
      "title": "Postunuz Beğenildi! ❤️",
      "message": "Alice postunuzu beğendi",
      "data": {
        "likerName": "Alice",
        "likerId": "uuid",
        "postId": "post-id",
        "navigation": {
          "screen": "PostDetail",
          "postId": "post-id"
        }
      },
      "read": false,
      "readAt": null,
      "createdAt": "2024-01-15T10:30:00.000Z",
      "updatedAt": "2024-01-15T10:30:00.000Z"
    }
  ]
}
```

---

### 2. Okunmamış Bildirim Sayısı

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

### 3. Bildirimi Okundu Olarak İşaretle

**Endpoint:** `PUT /notifications/:id/read`

**Response:**
```json
{
  "success": true,
  "message": "Notification marked as read"
}
```

---

### 4. Tüm Bildirimleri Okundu Olarak İşaretle

**Endpoint:** `PUT /notifications/mark-all-read`

**Response:**
```json
{
  "success": true,
  "message": "5 notifications marked as read",
  "data": {
    "count": 5
  }
}
```

---

## 🔴 Real-time Bildirimler (Socket.IO)

### Socket.IO Event: `notification`

Bildirimler gerçek zamanlı olarak Socket.IO üzerinden `notification` event'i ile gönderilir.

**Event Name:** `notification`

**Payload:**
```json
{
  "type": "POST_LIKED",
  "title": "Postunuz Beğenildi! ❤️",
  "message": "Alice postunuzu beğendi",
  "data": {
    "likerName": "Alice",
    "likerId": "uuid",
    "postId": "post-id",
    "navigation": {
      "screen": "PostDetail",
      "postId": "post-id"
    }
  },
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

**Mobil Uygulama Kullanımı:**
```typescript
socket.on('notification', (notification) => {
  // Bildirimi göster
  showNotification(notification);
  
  // Kullanıcı bildirime tıklarsa yönlendir
  if (notification.data?.navigation?.screen) {
    navigateToScreen(notification.data.navigation);
  }
});
```

---

## 📲 Push Bildirimler (Expo)

### Expo Push Notification Format

Push bildirimler Expo formatında gönderilir ve `data` objesi içinde navigation bilgisi taşır.

**Expo Push Message:**
```json
{
  "to": "ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]",
  "sound": "default",
  "title": "Postunuz Beğenildi! ❤️",
  "body": "Alice postunuzu beğendi",
  "data": {
    "likerName": "Alice",
    "likerId": "uuid",
    "postId": "post-id",
    "navigation": {
      "screen": "PostDetail",
      "postId": "post-id"
    }
  },
  "priority": "high"
}
```

**Mobil Uygulama Kullanımı (React Native - Expo):**
```typescript
import * as Notifications from 'expo-notifications';

// Push notification handler
Notifications.addNotificationResponseReceivedListener(response => {
  const data = response.notification.request.content.data;
  
  if (data?.navigation?.screen) {
    navigateToScreen(data.navigation);
  }
});
```

---

## 📱 Mobil Uygulama Entegrasyonu

### 1. Bildirim Yönlendirme Helper Fonksiyonu

```typescript
// navigation-helper.ts
import { NavigationContainerRef } from '@react-navigation/native';

interface NavigationData {
  screen: string;
  postId?: string;
  userId?: string;
  threadId?: string;
  requestId?: string;
  badgeId?: string;
  achievementId?: string;
}

export function navigateFromNotification(
  navigation: NavigationContainerRef<any>,
  navigationData: NavigationData
) {
  if (!navigationData.screen) {
    return; // Yönlendirme yok
  }

  switch (navigationData.screen) {
    case 'PostDetail':
      if (navigationData.postId) {
        navigation.navigate('PostStack', {
          screen: 'PostDetail',
          params: { postId: navigationData.postId },
        });
      }
      break;

    case 'Profile':
      if (navigationData.userId) {
        navigation.navigate('ProfileStack', {
          screen: 'Profile',
          params: { userId: navigationData.userId },
        });
      }
      break;

    case 'Chat':
      if (navigationData.threadId) {
        navigation.navigate('ChatStack', {
          screen: 'Chat',
          params: { threadId: navigationData.threadId },
        });
      }
      break;

    case 'SupportRequests':
      navigation.navigate('SupportStack', {
        screen: 'SupportRequests',
        params: navigationData.requestId 
          ? { requestId: navigationData.requestId } 
          : {},
      });
      break;

    case 'Badges':
      navigation.navigate('ProfileStack', {
        screen: 'Badges',
        params: navigationData.badgeId 
          ? { badgeId: navigationData.badgeId } 
          : {},
      });
      break;

    case 'Achievements':
      navigation.navigate('ProfileStack', {
        screen: 'Achievements',
        params: navigationData.achievementId 
          ? { achievementId: navigationData.achievementId } 
          : {},
      });
      break;

    case 'Wallet':
      navigation.navigate('WalletStack', {
        screen: 'Wallet',
      });
      break;

    case 'ExpertRequests':
      navigation.navigate('ExpertStack', {
        screen: 'ExpertRequests',
        params: navigationData.requestId 
          ? { requestId: navigationData.requestId } 
          : {},
      });
      break;

    default:
      console.warn(`Unknown navigation screen: ${navigationData.screen}`);
  }
}
```

---

### 2. Socket.IO Bildirim Handler

```typescript
// socket-notification-handler.ts
import { Socket } from 'socket.io-client';
import { navigateFromNotification } from './navigation-helper';

export function setupSocketNotificationHandler(
  socket: Socket,
  navigation: NavigationContainerRef<any>
) {
  socket.on('notification', (notification) => {
    // Bildirimi göster (toast, banner, vb.)
    showInAppNotification(notification);

    // Kullanıcı bildirime tıklarsa yönlendir
    if (notification.data?.navigation) {
      navigateFromNotification(navigation, notification.data.navigation);
    }
  });
}
```

---

### 3. Push Notification Handler

```typescript
// push-notification-handler.ts
import * as Notifications from 'expo-notifications';
import { navigateFromNotification } from './navigation-helper';

export function setupPushNotificationHandler(
  navigation: NavigationContainerRef<any>
) {
  // Foreground notification handler
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
    }),
  });

  // Notification response handler (kullanıcı bildirime tıkladığında)
  Notifications.addNotificationResponseReceivedListener((response) => {
    const data = response.notification.request.content.data;
    
    if (data?.navigation) {
      navigateFromNotification(navigation, data.navigation);
    }
  });
}
```

---

### 4. Bildirim Listesi Ekranında Yönlendirme

```typescript
// NotificationListScreen.tsx
import { useNavigation } from '@react-navigation/native';
import { navigateFromNotification } from './navigation-helper';

function NotificationListScreen() {
  const navigation = useNavigation();

  const handleNotificationPress = (notification: Notification) => {
    // Bildirimi okundu olarak işaretle
    markNotificationAsRead(notification.id);

    // Yönlendir
    if (notification.data?.navigation) {
      navigateFromNotification(navigation, notification.data.navigation);
    }
  };

  return (
    <FlatList
      data={notifications}
      renderItem={({ item }) => (
        <TouchableOpacity onPress={() => handleNotificationPress(item)}>
          <NotificationItem notification={item} />
        </TouchableOpacity>
      )}
    />
  );
}
```

---

## 🎯 Özet

1. **Her bildirim `data.navigation` objesi içinde yönlendirme bilgisi taşır**
2. **Navigation objesi `screen` alanı ile hedef ekranı belirtir**
3. **Ekran tipine göre gerekli parametreler (`postId`, `userId`, `threadId`, vb.) sağlanır**
4. **Mobil uygulama bu bilgiyi kullanarak kullanıcıyı ilgili ekrana yönlendirir**
5. **Hem API response, hem Socket.IO, hem de Push notification'larda aynı format kullanılır**

---

## 📚 İlgili Dokümanlar

- [NOTIFICATION_SYSTEM_IMPLEMENTATION.md](./NOTIFICATION_SYSTEM_IMPLEMENTATION.md)
- [NOTIFICATION_TESTING_GUIDE.md](./NOTIFICATION_TESTING_GUIDE.md)
- [COMPLETE_API_DOCUMENTATION.md](./COMPLETE_API_DOCUMENTATION.md)

