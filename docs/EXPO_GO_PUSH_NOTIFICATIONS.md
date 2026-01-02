# Expo Go'da Push Notification Sorun Giderme

## 🔍 Sorun: Bildirimler Expo Go'da Görünmüyor

Expo Go'da push notification'ların görünmemesi için birkaç olası neden vardır. Bu dokümantasyon, sorunları tespit etmek ve çözmek için adım adım rehber sağlar.

## 📋 Kontrol Listesi

### 1. Push Token Kayıtlı mı?

**Kontrol:**
```bash
docker-compose exec backend npx ts-node scripts/debug-expo-push.ts
```

**Çözüm:**
- Frontend'de push token'ı backend'e kaydetmek için `POST /notifications/push-token` endpoint'ini çağırın
- Token formatı: `ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]`

**Frontend Örnek Kodu:**
```typescript
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

async function registerForPushNotifications() {
  // İzin iste
  const { status } = await Notifications.requestPermissionsAsync();
  if (status !== 'granted') {
    console.log('Notification permission denied');
    return;
  }

  // Token al
  const tokenData = await Notifications.getExpoPushTokenAsync({
    projectId: 'your-project-id', // app.json'daki projectId
  });
  
  const token = tokenData.data;

  // Backend'e kaydet
  await api.post('/notifications/push-token', {
    token: token,
    deviceType: Platform.OS, // 'ios' | 'android'
  });
}
```

### 2. Notification Worker Çalışıyor mu?

**Kontrol:**
```bash
# Worker loglarını kontrol et
docker-compose logs backend | Select-String -Pattern "notification worker"
```

**Çözüm:**
- Worker otomatik olarak server başlatıldığında başlar
- Eğer worker çalışmıyorsa, server'ı yeniden başlatın
- Worker loglarında "Notification worker started successfully" mesajını arayın

### 3. User Notification Settings Kontrolü

**Kontrol:**
- User settings'te `notificationPushEnabled` true olmalı
- `receiveNotifications` true olmalı

**Çözüm:**
```typescript
// Settings'i kontrol et
const settings = await api.get('/notifications/settings');

// Gerekirse güncelle
await api.put('/notifications/settings', {
  notificationPushEnabled: true,
  receiveNotifications: true,
});
```

### 4. Expo Go Özel Durumlar

**⚠️ ÖNEMLİ:** Expo Go'da push notification'lar bazı limitasyonlara sahiptir:

1. **Development vs Production:**
   - Expo Go development build'lerinde push notification'lar çalışır
   - Ancak production build'lerde daha güvenilirdir
   - Development build için: `eas build --profile development --platform ios`

2. **Notification Permissions:**
   - iOS: Settings > Notifications > [Your App] > Allow Notifications
   - Android: Settings > Apps > [Your App] > Notifications > Allow

3. **Foreground Notifications:**
   - Expo Go'da foreground notification'lar otomatik gösterilmez
   - Manuel handling gerekir:

```typescript
// Foreground notification handler
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

// Notification listener
Notifications.addNotificationReceivedListener((notification) => {
  console.log('Notification received:', notification);
  // In-app notification göster
});
```

4. **Background Notifications:**
   - Background'da notification'lar otomatik gösterilir
   - Ancak Expo Go'da bazen gecikme olabilir

### 5. EXPO_ACCESS_TOKEN (Opsiyonel)

**Not:** Development için gerekli değil, production için önerilir.

**Kontrol:**
```bash
# .env dosyasında
EXPO_ACCESS_TOKEN=your_expo_access_token_here
```

**Çözüm:**
- Expo hesabınızdan access token alın
- Production push notification'lar için gerekli

### 6. Test Push Notification

**Manuel Test:**
```typescript
// Backend'den test notification gönder
await api.post('/notifications/test', {
  title: 'Test Notification',
  message: 'This is a test',
});
```

**Veya Test Script:**
```bash
docker-compose exec backend npx ts-node src/tests/notificationtest/notification.event.test.ts
```

## 🔧 Debug Adımları

### Adım 1: Push Token Kontrolü
```bash
docker-compose exec backend npx ts-node scripts/debug-expo-push.ts
```

### Adım 2: Worker Logları
```bash
docker-compose logs backend | Select-String -Pattern "notification"
```

### Adım 3: Frontend Logları
- Expo Go'da console logları kontrol edin
- `Notifications.getExpoPushTokenAsync()` çağrısının başarılı olduğunu doğrulayın
- Token'ın backend'e gönderildiğini doğrulayın

### Adım 4: Notification Test
- Bir interaction yapın (ör: post beğen)
- Notification'ın queue'ya eklendiğini kontrol edin
- Worker'ın notification'ı işlediğini kontrol edin
- Expo push service'in notification gönderdiğini kontrol edin

## 🐛 Yaygın Sorunlar ve Çözümleri

### Sorun 1: "No push tokens found"
**Çözüm:** Push token kayıtlı değil. Frontend'de token'ı kaydedin.

### Sorun 2: "No valid Expo push tokens"
**Çözüm:** Token formatı yanlış. `ExponentPushToken[...]` formatında olmalı.

### Sorun 3: "DeviceNotRegistered"
**Çözüm:** Token geçersiz veya device kayıtlı değil. Yeni token kaydedin.

### Sorun 4: Notification'lar queue'da kalıyor
**Çözüm:** Worker çalışmıyor. Server'ı yeniden başlatın.

### Sorun 5: Expo Go'da notification görünmüyor
**Çözüm:** 
- Notification permissions kontrol edin
- Foreground notification handler ekleyin
- Development build kullanın (production build daha güvenilir)

## 📱 Frontend Best Practices

### 1. Token Kayıt
```typescript
// App başlatıldığında token kaydet
useEffect(() => {
  registerForPushNotifications();
}, []);
```

### 2. Token Güncelleme
```typescript
// Token değiştiğinde güncelle
Notifications.addPushTokenListener((token) => {
  if (token) {
    api.post('/notifications/push-token', {
      token: token.data,
      deviceType: Platform.OS,
    });
  }
});
```

### 3. Notification Handling
```typescript
// Foreground handler
Notifications.setNotificationHandler({
  handleNotification: async (notification) => {
    // In-app notification göster
    showInAppNotification(notification);
    return {
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
    };
  },
});

// Background handler
Notifications.addNotificationResponseReceivedListener((response) => {
  // Navigation yap
  const { screen, postId } = response.notification.request.content.data;
  navigation.navigate(screen, { postId });
});
```

## 🚀 Production Build İçin

Expo Go yerine production build kullanmak için:

```bash
# iOS
eas build --platform ios --profile production

# Android
eas build --platform android --profile production
```

Production build'lerde push notification'lar daha güvenilir çalışır.

## 📞 Destek

Sorun devam ederse:
1. Debug script'i çalıştırın
2. Worker loglarını kontrol edin
3. Frontend console loglarını kontrol edin
4. Expo Go yerine development build deneyin


