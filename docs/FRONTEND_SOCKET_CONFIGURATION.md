# Frontend Socket.IO Yapılandırması ve Mesajlaşma Kılavuzu

Bu dokümantasyon, frontend tarafında Socket.IO yapılandırmasının nasıl yapılacağını ve 2 farklı kullanıcının nasıl mesajlaşacağını açıklar.

## 📦 Kurulum

Frontend projenizde Socket.IO client paketini yükleyin:

```bash
npm install socket.io-client
# veya
yarn add socket.io-client
```

## 🔧 Temel Yapılandırma

### 1. Socket Bağlantısı Oluşturma

Socket bağlantısı oluştururken **JWT token** gönderilmesi zorunludur. Backend, bağlantı kurulurken token'ı doğrular.

```typescript
import { io, Socket } from 'socket.io-client';

// Environment variable'dan backend URL'ini al
const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

// JWT token'ı localStorage veya state'den al
const token = localStorage.getItem('authToken'); // veya başka bir yerden

// Socket bağlantısı oluştur
const socket: Socket = io(BACKEND_URL, {
  auth: {
    token: token, // JWT token zorunlu
  },
  transports: ['websocket', 'polling'], // WebSocket öncelikli, polling fallback
  path: '/socket.io/', // Socket.IO pathname (backend'de default: /socket.io/)
  reconnection: true,
  reconnectionDelay: 1000,
  reconnectionAttempts: 5,
  timeout: 20000, // Connection timeout (20 saniye)
  forceNew: false, // Mevcut bağlantıyı yeniden kullan
});
```

### 2. Bağlantı Event'lerini Dinleme

```typescript
// Bağlantı başarılı olduğunda
socket.on('connect', () => {
  console.log('Socket bağlantısı kuruldu:', socket.id);
});

// Backend'den bağlantı onayı
socket.on('connected', (data: { message: string; userId: string; userEmail: string }) => {
  console.log('Backend bağlantı onayı:', data);
  // data.userId ile kullanıcı bilgisini alabilirsiniz
});

// Bağlantı kesildiğinde
socket.on('disconnect', (reason) => {
  console.log('Socket bağlantısı kesildi:', reason);
});

// Yeniden bağlanma denemeleri
socket.on('reconnect', (attemptNumber) => {
  console.log('Yeniden bağlandı, deneme:', attemptNumber);
});

// Bağlantı hatası
socket.on('connect_error', (error) => {
  console.error('Bağlantı hatası:', error.message);
  // Token geçersizse veya eksikse buraya düşer
});
```

## 💬 Mesajlaşma Akışı

### Senaryo: İki Kullanıcı Arasında Mesajlaşma

**Kullanıcı A** ve **Kullanıcı B** arasında mesajlaşma için aşağıdaki adımlar izlenir:

#### 1. Thread Oluşturma veya Mevcut Thread'i Alma

İlk mesaj gönderilmeden önce thread oluşturulmalı veya mevcut thread alınmalıdır. Bu işlem REST API üzerinden yapılır:

```typescript
// REST API ile thread oluştur veya al
async function getOrCreateThread(recipientId: string) {
  const response = await fetch(`${BACKEND_URL}/messages/threads`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ recipientId }),
  });
  
  if (!response.ok) {
    throw new Error(`Thread oluşturulamadı: ${response.statusText}`);
  }
  
  const thread = await response.json();
  return thread.id; // threadId
}
```

**Not:** Eğer thread zaten varsa, mevcut thread ID'si döner. Yeni thread oluşturulursa, yeni thread ID'si döner.

#### 2. Thread Room'una Katılma

Kullanıcı bir thread'i açtığında (mesajlaşma sayfası), o thread'in room'una katılmalıdır:

```typescript
// Thread sayfası açıldığında
function openThread(threadId: string) {
  // Thread room'una katıl
  socket.emit('join_thread', threadId);
  
  // Başarılı katılım onayını dinle
  socket.once('thread_joined', (data: { threadId: string }) => {
    console.log('Thread room\'una katıldı:', data.threadId);
    // Mesajları yükle ve dinlemeye başla
    loadMessages(threadId);
  });
  
  // Hata durumunu dinle
  socket.once('thread_join_error', (error: { threadId: string; reason: string }) => {
    console.error('Thread\'e katılamadı:', error.reason);
  });
}
```

#### 3. Mesaj Gönderme

**Yöntem 1: Socket üzerinden gönderme (Önerilen)**

```typescript
function sendMessage(threadId: string, message: string) {
  socket.emit('send_message', {
    threadId: threadId,
    message: message,
  });
  
  // Hata durumunu dinle
  socket.once('message_send_error', (error: { reason: string }) => {
    console.error('Mesaj gönderilemedi:', error.reason);
  });
}
```

**Yöntem 2: REST API üzerinden gönderme**

```typescript
async function sendMessageViaAPI(recipientId: string, message: string) {
  const response = await fetch(`${BACKEND_URL}/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({
      recipientId,
      message,
    }),
  });
  
  return await response.json();
}
```

#### 4. Yeni Mesajları Dinleme

```typescript
// new_message event'ini dinle (alıcı için)
socket.on('new_message', (data: NewMessageEvent) => {
  console.log('Yeni mesaj alındı:', data);
  // data.messageId, data.threadId, data.senderId, data.message, data.timestamp
  // UI'da mesajı göster
  addMessageToUI(data);
});

// message_sent event'ini dinle (gönderici için - onay)
socket.on('message_sent', (data: MessageSentEvent) => {
  console.log('Mesaj gönderildi (onay):', data);
  // UI'da mesajı "gönderildi" olarak işaretle
  markMessageAsSent(data.messageId);
});
```

#### 5. Typing Indicator (Yazıyor Göstergesi)

```typescript
let typingTimeout: NodeJS.Timeout;

// Kullanıcı yazmaya başladığında
function onTypingStart(threadId: string) {
  socket.emit('typing_start', { threadId });
  
  // 3 saniye sonra otomatik olarak durdur
  clearTimeout(typingTimeout);
  typingTimeout = setTimeout(() => {
    onTypingStop(threadId);
  }, 3000);
}

// Kullanıcı yazmayı durdurduğunda
function onTypingStop(threadId: string) {
  socket.emit('typing_stop', { threadId });
  clearTimeout(typingTimeout);
}

// Diğer kullanıcının yazdığını dinle
socket.on('user_typing', (data: TypingEvent) => {
  if (data.isTyping) {
    showTypingIndicator(data.userId);
  } else {
    hideTypingIndicator(data.userId);
  }
});
```

#### 6. Mesaj Okundu İşaretleme

```typescript
// Mesaj okundu olarak işaretle (Socket üzerinden - Önerilen)
function markMessageAsRead(messageId: string) {
  socket.emit('mark_message_read', { messageId }, (response: { success?: boolean; error?: string }) => {
    if (response.success) {
      console.log('Mesaj okundu olarak işaretlendi');
    } else {
      console.error('Hata:', response.error);
    }
  });
}

// Mesaj okundu bildirimini dinle (gönderici için)
socket.on('message_read', (data: MessageReadEvent) => {
  console.log('Mesaj okundu:', data);
  // data.messageId, data.threadId, data.readBy, data.timestamp
  // UI'da mesajı "okundu" olarak işaretle
  markMessageAsReadInUI(data.messageId);
});
```

#### 7. Thread'den Ayrılma

```typescript
// Thread sayfası kapatıldığında
function closeThread(threadId: string) {
  socket.emit('leave_thread', threadId);
  
  socket.once('thread_left', (data: { threadId: string }) => {
    console.log('Thread room\'undan ayrıldı:', data.threadId);
  });
}
```

## 📝 TypeScript Interface'leri

Frontend'de kullanabileceğiniz TypeScript interface'leri:

```typescript
// Mesajlaşma Event'leri
interface NewMessageEvent {
  messageId: string;
  threadId: string;
  senderId: string;
  recipientId: string;
  message: string;
  messageType: 'message' | 'support-request' | 'send-tips';
  timestamp: string;
  context?: 'DM' | 'SUPPORT';
}

interface MessageSentEvent extends NewMessageEvent {}

interface MessageReadEvent {
  messageId: string;
  threadId: string;
  readBy: string;
  timestamp: string;
}

interface TypingEvent {
  userId: string;
  threadId: string;
  isTyping: boolean;
}
```

## 🎯 Örnek React Hook Kullanımı

```typescript
import { useEffect, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';

export function useSocket(token: string | null) {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    if (!token) return;

    const newSocket = io(BACKEND_URL, {
      auth: { token },
      transports: ['websocket', 'polling'],
    });

    newSocket.on('connect', () => {
      setIsConnected(true);
      console.log('Socket bağlandı');
    });

    newSocket.on('disconnect', () => {
      setIsConnected(false);
      console.log('Socket bağlantısı kesildi');
    });

    newSocket.on('connected', (data) => {
      console.log('Backend onayı:', data);
    });

    setSocket(newSocket);

    return () => {
      newSocket.close();
    };
  }, [token]);

  return { socket, isConnected };
}

export function useMessaging(socket: Socket | null, threadId: string | null) {
  const [messages, setMessages] = useState<NewMessageEvent[]>([]);
  const [isTyping, setIsTyping] = useState(false);

  // Thread'e katıl
  useEffect(() => {
    if (!socket || !threadId) return;

    socket.emit('join_thread', threadId);

    socket.once('thread_joined', () => {
      console.log('Thread\'e katıldı');
    });

    return () => {
      socket.emit('leave_thread', threadId);
    };
  }, [socket, threadId]);

  // Mesajları dinle
  useEffect(() => {
    if (!socket) return;

    const handleNewMessage = (data: NewMessageEvent) => {
      setMessages((prev) => [...prev, data]);
    };

    const handleTyping = (data: TypingEvent) => {
      setIsTyping(data.isTyping);
    };

    socket.on('new_message', handleNewMessage);
    socket.on('user_typing', handleTyping);

    return () => {
      socket.off('new_message', handleNewMessage);
      socket.off('user_typing', handleTyping);
    };
  }, [socket]);

  const sendMessage = useCallback(
    (message: string) => {
      if (!socket || !threadId) return;
      socket.emit('send_message', { threadId, message });
    },
    [socket, threadId]
  );

  const markAsRead = useCallback(
    (messageId: string) => {
      if (!socket) return;
      socket.emit('mark_message_read', { messageId });
    },
    [socket]
  );

  return { messages, isTyping, sendMessage, markAsRead };
}
```

## 🔄 İki Kullanıcı Mesajlaşma Senaryosu

### Kullanıcı A (Gönderici)

1. **Bağlantı Kurma:**
   ```typescript
   const socketA = io(BACKEND_URL, { auth: { token: tokenA } });
   ```

2. **Thread Oluşturma/Alma:**
   ```typescript
   const thread = await getOrCreateThread(userBId);
   ```

3. **Thread Room'una Katılma:**
   ```typescript
   socketA.emit('join_thread', thread.id);
   ```

4. **Mesaj Gönderme:**
   ```typescript
   socketA.emit('send_message', { threadId: thread.id, message: 'Merhaba!' });
   ```

5. **Onay Dinleme:**
   ```typescript
   socketA.on('message_sent', (data) => {
     console.log('Mesaj gönderildi:', data);
   });
   ```

### Kullanıcı B (Alıcı)

1. **Bağlantı Kurma:**
   ```typescript
   const socketB = io(BACKEND_URL, { auth: { token: tokenB } });
   ```

2. **Yeni Mesajları Dinleme:**
   ```typescript
   socketB.on('new_message', (data) => {
     console.log('Yeni mesaj:', data.message);
     // UI'da göster
   });
   ```

3. **Thread Açıldığında:**
   ```typescript
   socketB.emit('join_thread', threadId);
   ```

4. **Mesaj Okundu İşaretleme:**
   ```typescript
   socketB.emit('mark_message_read', { messageId });
   ```

5. **Yanıt Gönderme:**
   ```typescript
   socketB.emit('send_message', { threadId, message: 'Merhaba, nasılsın?' });
   ```

## 🚨 Hata Yönetimi

```typescript
// Bağlantı hataları
socket.on('connect_error', (error) => {
  if (error.message.includes('Authentication')) {
    // Token geçersiz, yeniden giriş yap
    redirectToLogin();
  }
});

// Thread katılım hataları
socket.on('thread_join_error', (error) => {
  console.error('Thread hatası:', error.reason);
  // Kullanıcıya hata mesajı göster
});

// Mesaj gönderme hataları
socket.on('message_send_error', (error) => {
  console.error('Mesaj hatası:', error.reason);
  // Kullanıcıya hata mesajı göster
});
```

## 📋 Özet: Mesajlaşma Akış Şeması

```
1. Her iki kullanıcı da Socket.IO bağlantısı kurar (JWT token ile)
   ↓
2. Backend her kullanıcıyı otomatik olarak kendi userId room'una ekler (room adı: userId string)
   ↓
3. Kullanıcı A thread oluşturur/alır (REST API)
   ↓
4. Kullanıcı A thread room'una katılır (join_thread) - room adı: "thread:{threadId}"
   ↓
5. Kullanıcı A mesaj gönderir (send_message)
   ↓
6. Backend mesajı veritabanına kaydeder
   ↓
7. Backend:
   - Kullanıcı B'nin kişisel room'una (userId) 'new_message' gönderir
   - Thread room'una ('thread:{threadId}') 'new_message' gönderir (her iki kullanıcı da dinliyorsa)
   - Kullanıcı A'nın kişisel room'una (userId) 'message_sent' gönderir
   ↓
8. Kullanıcı B 'new_message' event'ini alır ve UI'da gösterir
   ↓
9. Kullanıcı B thread'i açarsa, thread room'una katılır (join_thread)
   ↓
10. Kullanıcı B mesajı okuduğunda 'mark_message_read' gönderir
   ↓
11. Backend 'message_read' event'ini Kullanıcı A'ya gönderir (kişisel room ve thread room)
```

## 🔐 Güvenlik Notları

1. **JWT Token:** Her socket bağlantısında geçerli bir JWT token gönderilmelidir. Token `auth.token` ile gönderilir ve backend `socket.handshake.auth.token` ile alır.
2. **Thread Erişim Kontrolü:** Backend, kullanıcının thread'e erişim yetkisi olup olmadığını kontrol eder. `join_thread` event'inde erişim kontrolü yapılır.
3. **CORS:** Backend CORS ayarları environment variable'lardan okunur. Development ortamında (`NODE_ENV=development`) tüm origin'lere izin verilir.
4. **Room İzolasyonu:** Kullanıcılar sadece kendi thread'lerine erişebilir. Backend her thread erişiminde `validateThreadAccess` kontrolü yapar.
5. **Room Adları:** 
   - Kullanıcı room'u: `userId` (string, otomatik katılım)
   - Thread room'u: `thread:{threadId}` (manuel katılım gerekli)

## ⚠️ Socket Bağlantı Sorunları ve Çözümleri

### Timeout Hatası

Eğer socket bağlantısı timeout veriyorsa:

1. **CORS Kontrolü:** Frontend URL'inizin `CORS_ORIGINS` environment variable'ında olduğundan emin olun
2. **Pathname Kontrolü:** Socket.IO pathname'inin `/socket.io/` olduğundan emin olun (default)
3. **Port Kontrolü:** Backend'in doğru port'ta çalıştığından emin olun (default: 3000)
4. **Network Kontrolü:** Firewall veya proxy ayarlarını kontrol edin

### Development Ortamı

Development ortamında (`NODE_ENV=development`), backend tüm origin'lere izin verir. Production'da sadece `CORS_ORIGINS` içindeki origin'ler izinlidir.

### Nginx/Reverse Proxy Kullanımı

Eğer nginx veya başka bir reverse proxy kullanıyorsanız, WebSocket upgrade header'larını doğru şekilde proxy'lemeniz gerekir:

```nginx
location /socket.io/ {
    proxy_pass http://backend:3000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_cache_bypass $http_upgrade;
    
    # Timeouts
    proxy_connect_timeout 60s;
    proxy_send_timeout 60s;
    proxy_read_timeout 60s;
}
```

## 📱 Mobil Uygulama (React Native) İçin Özel Notlar

### Token Yönetimi

React Native'de token'ı güvenli bir şekilde saklamak için `@react-native-async-storage/async-storage` veya `expo-secure-store` kullanın:

```typescript
// AsyncStorage kullanımı (basit)
import AsyncStorage from '@react-native-async-storage/async-storage';

const token = await AsyncStorage.getItem('authToken');

// SecureStore kullanımı (daha güvenli - Expo)
import * as SecureStore from 'expo-secure-store';

const token = await SecureStore.getItemAsync('authToken');
```

### App Lifecycle Yönetimi

React Native'de uygulama arka plana gittiğinde socket bağlantısını yönetmek:

```typescript
import { AppState } from 'react-native';

useEffect(() => {
  const subscription = AppState.addEventListener('change', (nextAppState) => {
    if (nextAppState === 'background') {
      // Uygulama arka plana gitti - socket otomatik olarak bağlı kalır
      console.log('App background');
    } else if (nextAppState === 'active') {
      // Uygulama ön plana geldi - socket bağlantısını kontrol et
      if (socket && !socket.connected) {
        socket.connect();
      }
      console.log('App active');
    }
  });

  return () => {
    subscription.remove();
  };
}, [socket]);
```

### Network State Yönetimi

Ağ durumunu izleyerek socket bağlantısını yönetmek:

```typescript
import NetInfo from '@react-native-community/netinfo';

useEffect(() => {
  const unsubscribe = NetInfo.addEventListener(state => {
    if (state.isConnected && socket && !socket.connected) {
      // Ağ bağlantısı geri geldi, socket'i yeniden bağla
      socket.connect();
    }
  });

  return () => {
    unsubscribe();
  };
}, [socket]);
```

### Global Socket Context (React Native)

Tüm uygulamada tek bir socket instance kullanmak için Context API:

```typescript
// contexts/SocketContext.tsx
import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import AsyncStorage from '@react-native-async-storage/async-storage';

const BACKEND_URL = 'https://api.tipbox.com';

interface SocketContextType {
  socket: Socket | null;
  isConnected: boolean;
}

const SocketContext = createContext<SocketContextType>({
  socket: null,
  isConnected: false,
});

export function SocketProvider({ children }: { children: React.ReactNode }) {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    async function initSocket() {
      const token = await AsyncStorage.getItem('authToken');
      if (!token) return;

      // Mevcut socket varsa yeniden kullan
      if (socketRef.current?.connected) {
        setSocket(socketRef.current);
        setIsConnected(true);
        return;
      }

      // Yeni socket bağlantısı
      const newSocket = io(BACKEND_URL, {
        auth: { token },
        transports: ['websocket', 'polling'],
        path: '/socket.io/',
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionAttempts: 5,
        timeout: 20000,
      });

      newSocket.on('connect', () => {
        setIsConnected(true);
        console.log('Socket bağlandı');
      });

      newSocket.on('disconnect', () => {
        setIsConnected(false);
        console.log('Socket bağlantısı kesildi');
      });

      newSocket.on('connected', (data) => {
        console.log('Backend onayı:', data);
      });

      newSocket.on('connect_error', (error) => {
        console.error('Bağlantı hatası:', error.message);
        setIsConnected(false);
      });

      socketRef.current = newSocket;
      setSocket(newSocket);
    }

    initSocket();

    return () => {
      // Cleanup - socket'i kapatma, sadece event listener'ları temizle
    };
  }, []);

  return (
    <SocketContext.Provider value={{ socket, isConnected }}>
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket() {
  return useContext(SocketContext);
}
```

### Chat Screen Örneği (React Native)

```typescript
// screens/ChatScreen.tsx
import React, { useEffect, useState } from 'react';
import { View, FlatList, TextInput, Button, Alert } from 'react-native';
import { useSocket } from '../contexts/SocketContext';

export function ChatScreen({ threadId }: { threadId: string }) {
  const { socket, isConnected } = useSocket();
  const [messages, setMessages] = useState<any[]>([]);
  const [messageText, setMessageText] = useState('');

  useEffect(() => {
    if (!socket || !threadId) return;

    // Thread room'una katıl
    socket.emit('join_thread', threadId);

    socket.once('thread_joined', () => {
      console.log('Thread room\'una katıldı');
      // Mesajları yükle
      loadMessages(threadId);
    });

    socket.once('thread_join_error', (error: { reason: string }) => {
      Alert.alert('Hata', error.reason);
    });

    // Yeni mesajları dinle
    const handleNewMessage = (data: any) => {
      setMessages(prev => [...prev, data]);
    };

    socket.on('new_message', handleNewMessage);

    return () => {
      socket.emit('leave_thread', threadId);
      socket.off('new_message', handleNewMessage);
    };
  }, [socket, threadId]);

  const sendMessage = () => {
    if (!socket || !threadId || !messageText.trim()) return;

    socket.emit('send_message', {
      threadId,
      message: messageText.trim(),
    });

    socket.once('message_send_error', (error: { reason: string }) => {
      Alert.alert('Hata', error.reason);
    });

    setMessageText('');
  };

  return (
    <View style={{ flex: 1 }}>
      <FlatList
        data={messages}
        keyExtractor={(item) => item.messageId}
        renderItem={({ item }) => (
          <View>
            <Text>{item.message}</Text>
          </View>
        )}
      />
      <TextInput
        value={messageText}
        onChangeText={setMessageText}
        placeholder="Mesaj yazın..."
      />
      <Button title="Gönder" onPress={sendMessage} disabled={!isConnected} />
    </View>
  );
}
```

### Önemli Mobil Notlar

1. **Token Güvenliği:** Token'ı `AsyncStorage` yerine `SecureStore` veya `Keychain` kullanarak saklayın
2. **Background Mode:** iOS ve Android'de background mode için özel izinler gerekebilir
3. **Battery Optimization:** Android'de battery optimization ayarları socket bağlantısını etkileyebilir
4. **Network Changes:** Ağ değişikliklerinde (WiFi ↔ Mobile Data) socket otomatik olarak yeniden bağlanır
5. **Deep Linking:** Chat ekranına deep link ile gelindiğinde socket bağlantısının hazır olduğundan emin olun

## 📚 İlgili Dokümantasyon

- [MESSAGING_SOCKET_EVENTS.md](./MESSAGING_SOCKET_EVENTS.md) - Tüm socket event'lerinin listesi
- [SOCKET_IO_INTEGRATION.md](./SOCKET_IO_INTEGRATION.md) - Backend socket entegrasyonu
- [SOCKET_INTEGRATION_SUMMARY.md](./SOCKET_INTEGRATION_SUMMARY.md) - Socket entegrasyon özeti

