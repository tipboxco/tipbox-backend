# 📱 Bildirim Sistemi Mimari Önerisi: Socket vs REST

## 🎯 Genel Bakış

Mobil tarafta Expo kullanılan yapı için bildirim sistemi mimarisi önerisi. Mevcut backend yapısı analiz edilerek optimal çözüm önerilmiştir.

---

## 📊 Mevcut Durum Analizi

### Backend'de Mevcut Yapı

1. **Socket.IO Entegrasyonu:**
   - ✅ `notification` event'i ile real-time bildirim gönderiliyor
   - ✅ Kullanıcılar kendi `userId` room'una katılıyor
   - ✅ `NotificationWorker` bildirim oluşturduğunda socket'e gönderiyor

2. **REST API:**
   - ✅ `GET /notifications` - Bildirim listesi (pagination, filtering)
   - ✅ `GET /notifications/unread-count` - Okunmamış sayısı (Redis cache ile)
   - ✅ `PUT /notifications/:id/read` - Okundu işaretle
   - ✅ `PUT /notifications/mark-all-read` - Tümünü okundu işaretle

3. **Cache Mekanizması:**
   - ✅ Redis cache ile unread count cache'leniyor
   - ✅ Yeni notification geldiğinde cache invalidate ediliyor
   - ✅ Read yapıldığında cache invalidate ediliyor

---

## 🏗️ Önerilen Mimari: Hybrid Yaklaşım

### ✅ Socket.IO Kullanılacak Durumlar

#### 1. **Yeni Bildirim Geldiğinde (Real-time)**
```typescript
// Backend: NotificationWorker
socket.emit('notification', {
  type: 'POST_LIKED',
  title: 'Post Liked! ❤️',
  message: 'Alice liked your post',
  data: { ... },
  avatar: 'http://...',
  imageUrl: 'http://...',
  timestamp: '2026-01-16T...'
});

// Mobil: SocketProvider
socket.on('notification', (notification) => {
  // 1. Bildirimi local state'e ekle
  addNotificationToLocalState(notification);
  
  // 2. Unread count'u artır
  incrementUnreadCount();
  
  // 3. Push notification göster (opsiyonel)
  showPushNotification(notification);
});
```

**Neden Socket?**
- ✅ Real-time güncelleme (anında görünür)
- ✅ Server push (polling'e gerek yok)
- ✅ Battery efficient (mobil için önemli)
- ✅ Zaten mevcut yapıda var

#### 2. **Unread Count Güncellemesi (Socket ile)**
```typescript
// Backend: NotificationWorker - notification gönderirken
socket.emit('notification', {
  ...notification,
  unreadCount: newUnreadCount // ✅ Eklenmeli
});

// Mobil: SocketProvider
socket.on('notification', (notification) => {
  // Unread count'u güncelle
  updateUnreadCount(notification.unreadCount);
});
```

**Neden Socket?**
- ✅ Anında güncelleme (badge sayısı hemen değişir)
- ✅ REST polling'e gerek yok
- ✅ Cache ile birlikte çalışır (fallback için)

---

### ✅ REST API Kullanılacak Durumlar

#### 1. **Bildirim Listesi (Pagination)**
```typescript
// Mobil: NotificationScreen
const { data } = useQuery({
  queryKey: ['notifications', { limit, offset, unreadOnly }],
  queryFn: () => api.get('/notifications', { params: { limit, offset, unreadOnly } })
});
```

**Neden REST?**
- ✅ Pagination için ideal (limit/offset)
- ✅ Filtering (unreadOnly, type, category)
- ✅ Search functionality
- ✅ Cache control (React Query ile)
- ✅ Offline support (React Query cache)

#### 2. **Unread Count (Initial Load & Fallback)**
```typescript
// Mobil: App başlangıcında veya socket bağlantısı yoksa
const { data: unreadCount } = useQuery({
  queryKey: ['notifications', 'unread-count'],
  queryFn: () => api.get('/notifications/unread-count'),
  staleTime: 30000, // 30 saniye
  refetchInterval: 60000, // 60 saniyede bir (socket yoksa)
});
```

**Neden REST?**
- ✅ Initial load (socket bağlantısı kurulmadan önce)
- ✅ Fallback (socket bağlantısı kesilirse)
- ✅ Cache ile hızlı response
- ✅ Background refresh (React Query ile)

#### 3. **Mark as Read (State Change)**
```typescript
// Mobil: NotificationItem
const markAsRead = useMutation({
  mutationFn: (notificationId: string) => 
    api.put(`/notifications/${notificationId}/read`),
  onSuccess: () => {
    // Local state'i güncelle
    updateNotificationReadState(notificationId);
    // Unread count'u azalt
    decrementUnreadCount();
  }
});
```

**Neden REST?**
- ✅ Idempotent operation (güvenli retry)
- ✅ State change (POST/PUT pattern)
- ✅ Error handling (network hatası durumunda)
- ✅ Optimistic update (React Query ile)

---

## 🔄 Önerilen Akış

### Senaryo 1: Yeni Bildirim Geldiğinde

```
1. Backend: NotificationWorker
   └─> Notification oluştur (DB'ye kaydet)
   └─> Socket.IO ile gönder:
       {
         type: 'POST_LIKED',
         title: '...',
         message: '...',
         data: { ... },
         avatar: '...',
         imageUrl: '...',
         unreadCount: 5, // ✅ YENİ: Unread count ekle
         timestamp: '...'
       }

2. Mobil: SocketProvider
   └─> socket.on('notification', handler)
   └─> Local state'e ekle (React Query cache'e)
   └─> Unread count'u güncelle (notification.unreadCount)
   └─> Badge'i güncelle
   └─> Push notification göster (opsiyonel)
```

### Senaryo 2: App Açıldığında

```
1. Mobil: App.tsx
   └─> Socket bağlantısı kur (SocketProvider)
   └─> REST API: GET /notifications/unread-count (initial load)
   └─> REST API: GET /notifications?limit=20 (initial list)

2. Socket bağlantısı kurulduktan sonra:
   └─> Socket event'lerini dinle
   └─> REST API polling'i durdur (socket varsa)
```

### Senaryo 3: Bildirim Okundu İşaretlendiğinde

```
1. Mobil: NotificationItem
   └─> REST API: PUT /notifications/:id/read
   └─> Optimistic update (local state)
   └─> Unread count'u azalt

2. Backend: NotificationRouter
   └─> DB'de read=true yap
   └─> Cache invalidate et
   └─> Socket ile broadcast (opsiyonel - diğer cihazlar için)
```

### Senaryo 4: Socket Bağlantısı Kesildiğinde

```
1. Mobil: SocketProvider
   └─> Disconnect event'i yakala
   └─> REST API polling'i başlat (fallback)
   └─> GET /notifications/unread-count (her 30 saniyede bir)

2. Socket bağlantısı tekrar kurulduğunda:
   └─> REST API polling'i durdur
   └─> Socket event'lerini dinle
```

---

## 🛠️ Backend Değişiklikleri

### 1. Socket Notification'a Unread Count Ekle

```typescript
// src/infrastructure/workers/notification.worker.ts

private async sendSocketNotification(userId: string, notification: any): Promise<void> {
  try {
    // Unread count'u al
    const unreadCount = await this.notificationRepo.getUnreadCount(userId);
    
    const socketNotification = {
      type: notification.type,
      title: notification.title,
      message: notification.message,
      data: notification.data,
      avatar: notification.avatar || null,
      imageUrl: notification.imageUrl || null,
      unreadCount: unreadCount, // ✅ YENİ: Unread count ekle
      timestamp: notification.timestamp || new Date().toISOString(),
    };
    
    await this.sendSocketNotification(userId, socketNotification);
  } catch (error) {
    logger.error(`Failed to send socket notification to user ${userId}:`, error);
  }
}
```

### 2. Mark as Read Sonrası Socket Broadcast (Opsiyonel)

```typescript
// src/interfaces/notification/notification.router.ts

router.put('/:id/read', authMiddleware, async (req, res) => {
  // ... mevcut kod ...
  
  // Socket ile unread count güncellemesi gönder (opsiyonel)
  const socketHandler = SocketManager.getInstance().getSocketHandler();
  const newUnreadCount = await notificationService.getUnreadCount(userId);
  
  socketHandler.sendMessageToUser(userId, 'notification_count_updated', {
    unreadCount: newUnreadCount,
  });
  
  // ... response ...
});
```

---

## 📱 Mobil Taraf Implementasyonu

### 1. SocketProvider Güncellemesi

```typescript
// src/providers/SocketProvider.tsx

export const SocketProvider = ({ children }) => {
  const { data: user } = useAuth();
  const queryClient = useQueryClient();
  const { setUnreadCount } = useNotificationStore();

  useEffect(() => {
    if (!user || !socket) return;

    // Notification event'i dinle
    socket.on('notification', (notification) => {
      // 1. Local state'e ekle (React Query cache)
      queryClient.setQueryData(['notifications'], (old: any) => {
        return {
          ...old,
          data: [notification, ...(old?.data || [])],
        };
      });

      // 2. Unread count'u güncelle
      if (notification.unreadCount !== undefined) {
        setUnreadCount(notification.unreadCount);
      } else {
        // Fallback: Mevcut count'u artır
        setUnreadCount(prev => prev + 1);
      }

      // 3. Push notification göster
      showPushNotification(notification);
    });

    // Unread count güncellemesi (ayrı event - opsiyonel)
    socket.on('notification_count_updated', ({ unreadCount }) => {
      setUnreadCount(unreadCount);
    });

    return () => {
      socket.off('notification');
      socket.off('notification_count_updated');
    };
  }, [user, socket, queryClient, setUnreadCount]);

  return <>{children}</>;
};
```

### 2. Unread Count Hook

```typescript
// src/hooks/useUnreadNotificationCount.ts

export const useUnreadNotificationCount = () => {
  const { data: user } = useAuth();
  const socket = useSocket();
  const { unreadCount, setUnreadCount } = useNotificationStore();

  // REST API fallback (socket yoksa veya initial load)
  const { data: restCount } = useQuery({
    queryKey: ['notifications', 'unread-count'],
    queryFn: () => api.get('/notifications/unread-count').then(r => r.data.data.count),
    enabled: !socket?.connected, // Socket yoksa REST kullan
    refetchInterval: socket?.connected ? false : 30000, // 30 saniye
    staleTime: 10000,
  });

  // Socket varsa socket'ten, yoksa REST'ten
  const count = socket?.connected ? unreadCount : (restCount ?? 0);

  return { count, isLoading: !socket?.connected && !restCount };
};
```

### 3. Notification List Hook

```typescript
// src/hooks/useNotifications.ts

export const useNotifications = (options?: {
  limit?: number;
  offset?: number;
  unreadOnly?: boolean;
}) => {
  const queryClient = useQueryClient();
  const socket = useSocket();

  // REST API ile listele
  const query = useQuery({
    queryKey: ['notifications', options],
    queryFn: () => 
      api.get('/notifications', { params: options })
        .then(r => r.data.data),
    staleTime: 30000,
  });

  // Socket'ten gelen yeni bildirimleri cache'e ekle
  useEffect(() => {
    if (!socket?.connected) return;

    const handler = (notification: any) => {
      queryClient.setQueryData(['notifications', options], (old: any) => {
        if (!old) return old;
        
        // Yeni bildirimi başa ekle
        return {
          ...old,
          data: [notification, ...old.data],
          pagination: {
            ...old.pagination,
            total: old.pagination.total + 1,
          },
        };
      });
    };

    socket.on('notification', handler);
    return () => socket.off('notification', handler);
  }, [socket, queryClient, options]);

  return query;
};
```

---

## 📋 Özet: Ne Zaman Ne Kullanılmalı?

| İşlem | Socket | REST | Neden |
|-------|--------|------|-------|
| **Yeni bildirim geldiğinde** | ✅ | ❌ | Real-time, anında güncelleme |
| **Unread count güncellemesi** | ✅ | ✅ | Socket: Real-time, REST: Fallback |
| **Bildirim listesi** | ❌ | ✅ | Pagination, filtering, search |
| **Mark as read** | ❌ | ✅ | State change, idempotent |
| **Initial load** | ❌ | ✅ | Socket bağlantısı kurulmadan önce |
| **Offline support** | ❌ | ✅ | React Query cache ile |

---

## 🎯 Sonuç ve Öneri

### ✅ Önerilen Yaklaşım: **Hybrid (Socket + REST)**

1. **Socket.IO:**
   - ✅ Yeni bildirimler (real-time)
   - ✅ Unread count güncellemesi (real-time)
   - ✅ Zaten mevcut yapıda var

2. **REST API:**
   - ✅ Bildirim listesi (pagination, filtering)
   - ✅ Mark as read (state change)
   - ✅ Initial load & fallback

3. **Cache Stratejisi:**
   - ✅ Redis cache (backend)
   - ✅ React Query cache (mobil)
   - ✅ Socket ile real-time sync

### 🚀 Avantajlar

- ✅ **Real-time güncelleme** (Socket ile)
- ✅ **Battery efficient** (polling yok)
- ✅ **Offline support** (React Query cache)
- ✅ **Fallback mekanizması** (Socket kesilirse REST)
- ✅ **Scalable** (Redis cache ile)
- ✅ **User experience** (anında güncelleme)

### ⚠️ Dikkat Edilmesi Gerekenler

1. **Socket bağlantısı kesilirse:**
   - REST API polling'e geç (fallback)
   - Reconnection logic ekle

2. **Unread count sync:**
   - Socket'ten gelen count'u kullan (güvenilir)
   - REST API sadece fallback için

3. **Cache invalidation:**
   - Socket event geldiğinde React Query cache'i güncelle
   - Mark as read sonrası cache'i invalidate et

---

## 📝 Implementation Checklist

### Backend
- [ ] Socket notification'a `unreadCount` ekle
- [ ] Mark as read sonrası socket broadcast (opsiyonel)
- [ ] Cache invalidation kontrolü

### Mobil
- [ ] SocketProvider'da notification event handler
- [ ] Unread count hook (Socket + REST fallback)
- [ ] Notification list hook (REST + Socket sync)
- [ ] Mark as read mutation
- [ ] Offline support (React Query cache)
- [ ] Reconnection logic

---

Bu mimari, Instagram/Twitter gibi modern mobil uygulamaların kullandığı pattern'e uygundur ve production-ready'dir.
