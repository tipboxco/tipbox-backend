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

**Neden Gerekli?**

`POST /messages/threads` endpoint'i **sadece thread ID almak için** kullanılır. Mesaj göndermek için REST API kullanılmaz, her şey socket üzerinden gerçekleşir.

1. **Thread ID Almak**: Socket ile mesaj göndermek (`send_message`) ve thread room'una katılmak (`join_thread`) için `threadId` gerekir.

2. **Thread Oluşturma**: İki kullanıcı arasında ilk mesajlaşma başlatılırken yeni bir thread oluşturulur.

3. **Mevcut Thread'i Bulma**: Eğer kullanıcılar arasında zaten bir thread varsa, yeni thread oluşturmak yerine mevcut thread ID'si döner (duplicate thread'ler önlenir).

4. **Socket Room Yönetimi**: Socket ile mesajlaşmak için `join_thread` event'ine thread ID gönderilmesi gerekir.

5. **Mesaj Geçmişi**: Thread ID ile mesaj geçmişi (`GET /messages/{threadId}`) alınabilir.

**Önemli:** Bu endpoint mesaj göndermek için değil, sadece thread ID almak için kullanılır. Mesaj göndermek için socket `send_message` event'i kullanılır.

**Kullanım Senaryosu:**

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
  return thread.id; // threadId - Bu ID'yi mesaj göndermek için kullanacaksınız
}
```

**Backend Davranışı:**

- **Thread Varsa**: Mevcut thread ID'sini döner (yeni thread oluşturmaz)
- **Thread Yoksa**: Yeni bir normal DM thread oluşturur ve thread ID'sini döner
- **Kullanıcı Yoksa**: 404 döner (`Recipient user not found`)
- **Auth Hatası**: 401 döner (`Unauthorized`)

**Not:** Eğer thread zaten varsa, mevcut thread ID'si döner. Yeni thread oluşturulursa, yeni thread ID'si döner. Her iki durumda da thread ID alınır ve mesaj göndermek için kullanılır.

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

**⚠️ Önemli:** Mesaj göndermek için **sadece Socket kullanılır**. REST API endpoint'i (`POST /messages`) kullanılmaz.

**Socket üzerinden mesaj gönderme:**

```typescript
function sendMessage(threadId: string, message: string) {
  // Socket ile mesaj gönder
  socket.emit('send_message', {
    threadId: threadId,
    message: message,
  });
  
  // Hata durumunu dinle
  socket.once('message_send_error', (error: { reason: string }) => {
    console.error('Mesaj gönderilemedi:', error.reason);
    // Kullanıcıya hata mesajı göster
  });
  
  // Başarılı gönderim onayını dinle (opsiyonel)
  socket.once('message_sent', (data: MessageSentEvent) => {
    console.log('Mesaj gönderildi:', data);
    // UI'da mesajı "gönderildi" olarak işaretle
  });
}
```

**Backend İşleyişi:**

1. Socket `send_message` event'ini alır
2. Thread erişim kontrolü yapılır
3. Mesaj veritabanına kaydedilir
4. Socket event'leri gönderilir:
   - `new_message` → Alıcıya gönderilir
   - `message_sent` → Göndericiye onay olarak gönderilir

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

2. **Thread ID Alma (REST API):**
   ```typescript
   // Sadece thread ID almak için REST API kullanılır
   const thread = await getOrCreateThread(userBId);
   // thread.id → threadId
   ```

3. **Thread Room'una Katılma (Socket):**
   ```typescript
   socketA.emit('join_thread', thread.id);
   ```

4. **Mesaj Gönderme (Socket - Tek Yöntem):**
   ```typescript
   // Mesaj göndermek için SADECE socket kullanılır
   socketA.emit('send_message', { threadId: thread.id, message: 'Merhaba!' });
   ```

5. **Onay Dinleme (Socket):**
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
3. Kullanıcı A thread ID alır (REST API: POST /messages/threads) - Sadece thread ID için
   ↓
4. Kullanıcı A thread room'una katılır (Socket: join_thread) - room adı: "thread:{threadId}"
   ↓
5. Kullanıcı A mesaj gönderir (Socket: send_message) - REST API kullanılmaz
   ↓
6. Backend mesajı veritabanına kaydeder
   ↓
7. Backend Socket event'leri gönderir:
   - Kullanıcı B'nin kişisel room'una (userId) 'new_message' gönderir
   - Thread room'una ('thread:{threadId}') 'new_message' gönderir (her iki kullanıcı da dinliyorsa)
   - Kullanıcı A'nın kişisel room'una (userId) 'message_sent' gönderir
   ↓
8. Kullanıcı B 'new_message' event'ini alır ve UI'da gösterir
   ↓
9. Kullanıcı B thread'i açarsa, thread room'una katılır (Socket: join_thread)
   ↓
10. Kullanıcı B mesajı okuduğunda 'mark_message_read' gönderir (Socket)
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

## 🔄 Mobil Uygulama Socket Yaşam Döngüsü

### Login Sonrası Socket Bağlantısı

Login başarılı olduğunda socket bağlantısı otomatik olarak başlatılmalı:

```typescript
// src/features/auth/api/hooks.ts
export function useLogin() {
  const { connectSocket } = useSocketService();

  return useMutation({
    mutationFn: loginApi,
    onSuccess: async (data) => {
      // Token'ı kaydet
      await SecureStore.setItemAsync('authToken', data.token);
      
      // Socket bağlantısını başlat
      await connectSocket();
    },
  });
}
```

### Logout Sonrası Socket Disconnect

Logout yapıldığında socket bağlantısı kapatılmalı:

```typescript
// src/store/appStore.ts
export const useAppStore = create((set) => ({
  logout: async () => {
    const { disconnectSocket } = useSocketService();
    
    // Socket bağlantısını kapat
    await disconnectSocket();
    
    // Token'ı sil
    await SecureStore.deleteItemAsync('authToken');
    
    // State'i temizle
    set({ user: null, isAuthenticated: false });
  },
}));
```

### App Başlangıcında Socket Bağlantısı

Uygulama başladığında, eğer kullanıcı zaten login ise socket bağlantısı başlatılmalı:

```typescript
// App.tsx
import { useEffect } from 'react';
import { AppState } from 'react-native';
import { useSocketService } from './src/services/SocketService';
import { useAppStore } from './src/store/appStore';

export default function App() {
  const { connectSocket, isConnected } = useSocketService();
  const { isAuthenticated } = useAppStore();

  useEffect(() => {
    // App başlangıcında socket bağlantısını kontrol et
    if (isAuthenticated && !isConnected) {
      connectSocket();
    }
  }, [isAuthenticated]);

  useEffect(() => {
    // AppState değişikliklerini dinle
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active' && isAuthenticated && !isConnected) {
        // Foreground'a geldiğinde socket bağlantısını kontrol et
        connectSocket();
      }
    });

    return () => {
      subscription.remove();
    };
  }, [isAuthenticated, isConnected]);
}
```

## ✅ Backend Gereksinimleri

Socket'in çalışması için backend'de şunlar olmalı:

### 1. Socket.IO Server Çalışıyor Olmalı

- Backend'de Socket.IO server'ı çalışıyor olmalı
- URL: `http://192.168.1.165:3000` (veya `api.config.ts`'deki BASE_URL)
- Path: `/socket.io/`
- Port: 3000 (veya environment variable'dan)

### 2. JWT Token Authentication

Backend, socket bağlantısında JWT token'ı doğrulamalı:
- Token `auth.token` ile gönderilir
- Backend `socket.handshake.auth.token` ile alır
- Token geçerli ve süresi dolmamış olmalı
- Backend `AuthService.validateToken()` ile doğrular

### 3. Backend Event'leri

Backend şu event'leri desteklemeli:

| Event | Yön | Açıklama |
|-------|-----|----------|
| `connect` | Client → Server | Bağlantı başarılı |
| `connected` | Server → Client | Backend bağlantı onayı (`{ message, userId, userEmail }`) |
| `disconnect` | Her iki yön | Bağlantı kesildi |
| `thread_joined` | Server → Client | Thread room'una katılım başarılı |
| `thread_join_error` | Server → Client | Thread katılım hatası |
| `new_message` | Server → Client | Yeni mesaj geldi |
| `message_sent` | Server → Client | Mesaj gönderildi (onay) |
| `message_send_error` | Server → Client | Mesaj gönderme hatası |
| `user_typing` | Server → Client | Kullanıcı yazıyor |
| `message_read` | Server → Client | Mesaj okundu |

## 📋 Kontrol Listesi

Socket'in çalışıp çalışmadığını kontrol etmek için:

### 1. Backend Socket Server Çalışıyor mu?

```bash
# Backend'de socket server'ın çalıştığından emin olun
# Terminal'de backend loglarını kontrol edin:
# "SocketHandler initialized successfully" mesajını görmelisiniz
# "User connected: {email}" mesajını görmelisiniz (login sonrası)
```

### 2. Token Geçerli mi?

- Login yapıldıktan sonra token SecureStore'a kaydediliyor
- Token geçerli ve süresi dolmamış olmalı
- Token formatı: JWT (JSON Web Token)
- Backend token'ı doğrulayabilmeli

### 3. URL Doğru mu?

- `src/config/api.config.ts` dosyasındaki `BASE_URL` doğru olmalı
- Örnek: `http://192.168.1.165:3000` (development)
- Production'da: `https://api.tipbox.com`
- URL'de protokol (`http://` veya `https://`) olmalı

### 4. Network Bağlantısı Var mı?

- Cihaz ve backend aynı network'te olmalı (development için)
- Firewall socket bağlantısını engellememeli
- Port 3000 açık olmalı (veya backend'in kullandığı port)

### 5. CORS Ayarları Doğru mu?

- Development ortamında (`NODE_ENV=development`) backend tüm origin'lere izin verir
- Production'da `CORS_ORIGINS` environment variable'ında mobil uygulama origin'i olmalı
- Socket.IO CORS ayarları backend'de yapılandırılmış olmalı

## 🐛 Hata Ayıklama

### Timeout Hatası

```
ERROR [SocketService] Max reconnection attempts reached
ERROR [SocketService] Connection error details: {"message": "timeout", ...}
```

**Olası Nedenler:**
1. Backend socket server çalışmıyor
2. Network bağlantısı yok
3. Firewall socket bağlantısını engelliyor
4. Backend URL yanlış
5. Port yanlış veya kapalı

**Çözüm:**
1. Backend'de socket server'ın çalıştığını kontrol edin
2. Backend loglarını kontrol edin (`SocketHandler initialized successfully`)
3. Network bağlantısını test edin (ping, curl)
4. `api.config.ts`'deki URL'i kontrol edin
5. Port'un açık olduğundan emin olun

### Authentication Hatası

```
ERROR [SocketService] Authentication error: ...
ERROR [SocketService] Connection error: Invalid authentication token
```

**Olası Nedenler:**
1. Token geçersiz veya süresi dolmuş
2. Backend token'ı doğrulayamıyor
3. Token formatı yanlış
4. Token SecureStore'dan okunamıyor

**Çözüm:**
1. Yeniden login yapın
2. Token'ın geçerli olduğundan emin olun
3. SecureStore'dan token'ı okuyup kontrol edin
4. Backend loglarını kontrol edin (`Socket authentication error`)

### Connection Refused Hatası

```
ERROR [SocketService] Connection error: connect ECONNREFUSED
```

**Olası Nedenler:**
1. Backend çalışmıyor
2. Yanlış URL veya port
3. Network bağlantısı yok

**Çözüm:**
1. Backend'in çalıştığını kontrol edin
2. URL ve port'u kontrol edin
3. Network bağlantısını test edin

## 📝 Log Mesajları

Socket bağlantısı sırasında şu log mesajları görülebilir:

### Başarılı Bağlantı

```
[SocketService] Connecting to: http://192.168.1.165:3000
[SocketService] Access token available: true
[SocketService] Connected to server, socket ID: <socket-id>
[SocketService] Backend connection confirmed: { message, userId, userEmail }
```

### Hata Durumu

```
[SocketService] Connection attempt 1/5 failed: timeout
[SocketService] Max reconnection attempts reached
[SocketService] Socket features disabled. Application will continue with REST API only.
```

### Backend Logları (Başarılı)

```
SocketHandler initialized successfully
Socket authenticated for user: user@example.com (ID: 123)
User connected: user@example.com (ID: 123)
User user@example.com joined room: 123
```

### Backend Logları (Hata)

```
Socket connection attempt without token
Socket connection attempt with invalid token
Socket authentication error: ...
```

## ⚠️ Önemli Notlar

1. **Socket Bağlantısı Kritik Değil**: Socket bağlantısı başarısız olsa bile uygulama REST API ile çalışmaya devam eder. Socket özellikleri (real-time mesajlaşma, typing indicators) devre dışı kalır.

2. **Otomatik Yeniden Bağlanma**: Socket.IO otomatik olarak yeniden bağlanmayı dener (5 deneme). Başarısız olursa socket özellikleri devre dışı kalır.

3. **Token Güncelleme**: Token yenilendiğinde socket bağlantısı otomatik olarak güncellenmez. Yeniden bağlanma gerekebilir veya token refresh mekanizması implement edilmeli.

4. **Background Mode**: iOS ve Android'de background mode için özel izinler gerekebilir. Socket bağlantısı background'da kesilebilir.

5. **Battery Optimization**: Android'de battery optimization ayarları socket bağlantısını etkileyebilir. Kullanıcıdan battery optimization'ı devre dışı bırakması istenebilir.

6. **Network Changes**: Ağ değişikliklerinde (WiFi ↔ Mobile Data) socket otomatik olarak yeniden bağlanır. Ancak bağlantı kesintisi olabilir.

## 🐛 "Thread Endpoint Not Available" Hatası

### Hata Mesajı
```
INFO [MessageDetail] Thread endpoint not available, using recipientUserId as threadId (fallback mode)
```

### Neden Oluşur?

Bu hata, mobil uygulamanın `POST /messages/threads` endpoint'ine istek atamadığında veya istek başarısız olduğunda oluşur. Uygulama fallback moduna geçer ve `recipientUserId`'yi `threadId` olarak kullanır.

### Olası Nedenler

1. **Network Hatası**
   - Backend'e erişilemiyor
   - Timeout oluşuyor
   - Network bağlantısı kesik

2. **Authentication Hatası**
   - Token geçersiz veya süresi dolmuş
   - Token header'da gönderilmiyor
   - Token formatı yanlış

3. **Endpoint URL Hatası**
   - Base URL yanlış
   - Endpoint path yanlış (`/messages/threads`)
   - Port yanlış

4. **Request Formatı Hatası**
   - `recipientId` eksik veya yanlış format
   - Request body formatı yanlış
   - Content-Type header eksik

5. **Backend Yanıt Hatası**
   - Backend 404 döndürüyor (recipient user not found)
   - Backend 401 döndürüyor (unauthorized)
   - Backend 500 döndürüyor (server error)

### Debug Adımları

#### 1. Network Loglarını Kontrol Et

Mobil uygulamada network isteklerini loglayın:

```typescript
// Thread endpoint çağrısı öncesi
console.log('[MessageDetail] Calling thread endpoint:', {
  url: `${BASE_URL}/messages/threads`,
  recipientId: recipientUserId,
  token: token ? 'present' : 'missing',
});

try {
  const response = await fetch(`${BASE_URL}/messages/threads`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ recipientId: recipientUserId }),
  });

  console.log('[MessageDetail] Thread endpoint response:', {
    status: response.status,
    ok: response.ok,
    statusText: response.statusText,
  });

  if (!response.ok) {
    const errorData = await response.json();
    console.error('[MessageDetail] Thread endpoint error:', errorData);
  } else {
    const data = await response.json();
    console.log('[MessageDetail] Thread endpoint success:', data);
  }
} catch (error) {
  console.error('[MessageDetail] Thread endpoint exception:', error);
}
```

#### 2. Backend Loglarını Kontrol Et

Backend terminalinde şu logları kontrol edin:

```bash
# Başarılı istek için:
POST /messages/threads 200

# Hata durumları için:
POST /messages/threads 401 - Unauthorized
POST /messages/threads 404 - Recipient user not found
POST /messages/threads 400 - recipientId is required
```

#### 3. Market Test User Kontrolü

Market test user'ın veritabanında var olduğundan emin olun:

```sql
-- Market test user ID: 248cc91f-b551-4ecc-a885-db1163571330
SELECT id, email, status FROM users WHERE id = '248cc91f-b551-4ecc-a885-db1163571330';
```

#### 4. Token Kontrolü

Token'ın geçerli olduğundan emin olun:

```typescript
// Token'ı decode edip kontrol et
const tokenPayload = jwt.decode(token);
console.log('Token payload:', tokenPayload);
console.log('Token expired:', tokenPayload?.exp < Date.now() / 1000);
```

#### 5. Endpoint Testi

Backend endpoint'ini manuel olarak test edin:

```bash
# curl ile test
curl -X POST http://192.168.1.165:3000/messages/threads \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"recipientId": "248cc91f-b551-4ecc-a885-db1163571330"}'
```

### Çözüm Önerileri

#### 1. Error Handling İyileştirmesi

Mobil uygulamada thread endpoint çağrısını iyileştirin:

```typescript
async function getOrCreateThread(recipientId: string): Promise<string | null> {
  try {
    const response = await fetch(`${BASE_URL}/messages/threads`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ recipientId }),
      timeout: 10000, // 10 saniye timeout
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('[MessageDetail] Thread endpoint error:', {
        status: response.status,
        error: errorData,
      });

      // 404: Recipient user not found
      if (response.status === 404) {
        throw new Error('Recipient user not found');
      }

      // 401: Unauthorized
      if (response.status === 401) {
        throw new Error('Authentication failed');
      }

      throw new Error(`Thread endpoint failed: ${response.status}`);
    }

    const data = await response.json();
    return data.id; // threadId
  } catch (error) {
    console.error('[MessageDetail] Thread endpoint exception:', error);
    
    // Fallback: recipientUserId'yi threadId olarak kullan
    console.warn('[MessageDetail] Thread endpoint not available, using recipientUserId as threadId (fallback mode)');
    return recipientId; // Fallback
  }
}
```

#### 2. Retry Mekanizması

Network hatalarında retry ekleyin:

```typescript
async function getOrCreateThreadWithRetry(
  recipientId: string,
  maxRetries: number = 3
): Promise<string | null> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const threadId = await getOrCreateThread(recipientId);
      return threadId;
    } catch (error) {
      if (attempt === maxRetries) {
        console.error('[MessageDetail] Max retries reached, using fallback');
        return recipientId; // Fallback
      }
      
      // Exponential backoff
      await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
    }
  }
  
  return recipientId; // Fallback
}
```

#### 3. Market Test User Özel Durumu

Eğer market test user için özel bir durum varsa, kontrol ekleyin:

```typescript
const MARKET_TEST_USER_ID = '248cc91f-b551-4ecc-a885-db1163571330';

async function getOrCreateThread(recipientId: string): Promise<string | null> {
  // Market test user için özel kontrol
  if (recipientId === MARKET_TEST_USER_ID) {
    console.log('[MessageDetail] Market test user detected, ensuring user exists');
    // Özel işlemler...
  }

  // Normal thread endpoint çağrısı
  // ...
}
```

### Backend Kontrolü

Backend'de market test user'ın var olduğundan emin olun:

```typescript
// Backend'de recipient kontrolü
const recipient = await userRepo.findById(recipientId);
if (!recipient) {
  return res.status(404).json({ message: 'Recipient user not found' });
}
```

### Özet

1. **Backend çalışıyor mu?** - Backend loglarını kontrol edin
2. **Token geçerli mi?** - Token'ı decode edip kontrol edin
3. **Network bağlantısı var mı?** - Network isteklerini loglayın
4. **Market test user var mı?** - Veritabanında kontrol edin
5. **Endpoint doğru mu?** - URL ve path'i kontrol edin

Fallback modu çalışıyor, ancak thread endpoint'inin neden başarısız olduğunu bulmak için yukarıdaki adımları takip edin.

## 🔗 İlgili Dosyalar (Mobil Uygulama)

- `src/services/SocketService/index.ts` - Socket service implementasyonu
- `src/features/auth/api/hooks.ts` - Login sonrası socket bağlantısı
- `src/store/appStore.ts` - Logout sonrası socket disconnect
- `App.tsx` - App başlangıcında socket bağlantısı
- `src/config/api.config.ts` - API ve socket URL konfigürasyonu
- `MessageDetail` component - Thread endpoint çağrısı yapılan yer

## 🔧 Backend'de Socket Nasıl Çalışıyor?

### Mimari Yapı

Backend'de socket işlemleri şu katmanlar üzerinden gerçekleşir:

```
Socket.IO Server (io)
    ↓
SocketHandler (socket.handler.ts)
    ↓
MessagingService (messaging.service.ts)
    ↓
Database (Prisma)
```

### Socket Handler → MessagingService İlişkisi

**Socket Handler** (`src/infrastructure/realtime/socket.handler.ts`):
- Socket event'lerini dinler (`send_message`, `join_thread`, vs.)
- İstekleri doğrular (thread erişim kontrolü, validasyon)
- **MessagingService**'i çağırarak iş mantığını uygular
- Socket event'lerini göndermez (MessagingService yapar)

**MessagingService** (`src/application/messaging/messaging.service.ts`):
- İş mantığını uygular (mesaj kaydetme, thread oluşturma)
- Veritabanı işlemlerini yapar
- **SocketHandler**'ı kullanarak socket event'lerini gönderir

### Mesaj Gönderme Akışı (Backend)

#### 1. Socket Event Alınır

```typescript
// socket.handler.ts
socket.on('send_message', async (data: { threadId: string; message: string }) => {
  // 1. Validasyon
  if (!threadId || !message) {
    socket.emit('message_send_error', { reason: 'Invalid data' });
    return;
  }

  // 2. Thread erişim kontrolü
  const hasAccess = await this.messagingService.validateThreadAccess(threadId, userId);
  if (!hasAccess) {
    socket.emit('message_send_error', { reason: 'Access denied' });
    return;
  }

  // 3. Thread bilgisini al
  const thread = await this.messagingService.getThreadById(threadId);
  const recipientId = thread.userOneId === userId ? thread.userTwoId : thread.userOneId;

  // 4. MessagingService'i çağır (iş mantığı burada)
  await this.messagingService.sendDirectMessage(userId, recipientId, message.trim());
});
```

#### 2. MessagingService İş Mantığını Uygular

```typescript
// messaging.service.ts
async sendDirectMessage(senderId: string, recipientId: string, message: string) {
  // 1. Kullanıcı kontrolü
  const sender = await this.userRepo.findById(String(senderId));
  const recipient = await this.userRepo.findById(String(recipientId));
  if (!sender || !recipient) throw new Error('User not found');

  // 2. Thread oluştur veya al
  const thread = await this.createThreadIfNotExists(senderId, recipientId);

  // 3. Mesajı veritabanına kaydet
  const createdMessage = await this.prisma.dMMessage.create({
    data: {
      threadId: thread.id,
      senderId: String(senderId),
      message,
      isRead: false,
      context: "DM",
      sentAt: new Date(),
    },
  });

  // 4. Thread'i güncelle
  await this.prisma.dMThread.update({
    where: { id: thread.id },
    data: { updatedAt: new Date() },
  });

  // 5. Socket event'lerini gönder (SocketHandler kullanarak)
  const socketHandler = SocketManager.getInstance().getSocketHandler();
  const newMessageEvent = {
    messageId: createdMessage.id,
    threadId: thread.id,
    senderId: senderId,
    recipientId: recipientId,
    message,
    messageType: 'message' as const,
    context: "DM",
    timestamp: createdMessage.sentAt.toISOString(),
  };

  // Alıcıya gönder
  socketHandler.sendMessageToUser(recipientId, 'new_message', newMessageEvent);
  
  // Thread room'una gönder
  socketHandler.sendToRoom(`thread:${thread.id}`, 'new_message', newMessageEvent);

  // Göndericiye onay gönder
  socketHandler.sendMessageToUser(senderId, 'message_sent', newMessageEvent);
}
```

### Servisler Arası İlişki

```
┌─────────────────────────────────────────┐
│         Socket.IO Server (io)           │
│  - Socket bağlantılarını yönetir        │
│  - Event'leri dinler                    │
└─────────────────┬───────────────────────┘
                  │
                  ↓
┌─────────────────────────────────────────┐
│      SocketHandler (socket.handler.ts)  │
│  - Socket event handler'ları             │
│  - Validasyon ve erişim kontrolü        │
│  - MessagingService'i çağırır           │
└─────────────────┬───────────────────────┘
                  │
                  ↓
┌─────────────────────────────────────────┐
│   MessagingService (messaging.service)  │
│  - İş mantığı (mesaj kaydetme, thread) │
│  - Veritabanı işlemleri                 │
│  - SocketHandler'ı kullanarak event     │
│    gönderir (sendMessageToUser, etc.)  │
└─────────────────┬───────────────────────┘
                  │
                  ↓
┌─────────────────────────────────────────┐
│         Database (Prisma)               │
│  - DMMessage, DMThread tabloları        │
└─────────────────────────────────────────┘
```

### Önemli Noktalar

1. **Socket Handler → MessagingService**: Socket Handler, iş mantığını MessagingService'e devreder
2. **MessagingService → SocketHandler**: MessagingService, socket event'lerini göndermek için SocketHandler'ı kullanır
3. **Circular Dependency Yok**: SocketHandler MessagingService'i constructor'da alır, MessagingService SocketHandler'ı singleton pattern ile alır
4. **Separation of Concerns**: 
   - SocketHandler: Socket işlemleri, validasyon
   - MessagingService: İş mantığı, veritabanı, socket bildirimleri

### Socket Event Gönderme Metodları

SocketHandler'da şu metodlar kullanılır:

```typescript
// Belirli bir kullanıcıya mesaj gönder
socketHandler.sendMessageToUser(userId, 'new_message', eventData);

// Belirli bir room'a mesaj gönder
socketHandler.sendToRoom('thread:threadId', 'new_message', eventData);

// Tüm client'lara yayın yap
socketHandler.broadcast('user_presence', eventData);
```

### Özet: Backend Akışı

1. **Client** → Socket event gönderir (`send_message`)
2. **SocketHandler** → Event'i alır, validasyon yapar
3. **SocketHandler** → MessagingService'i çağırır
4. **MessagingService** → Veritabanına mesajı kaydeder
5. **MessagingService** → SocketHandler'ı kullanarak socket event'lerini gönderir
6. **Client** → Socket event'lerini alır (`new_message`, `message_sent`)

**Sonuç:** Backend'de socket sadece iletişim katmanıdır. İş mantığı MessagingService'de, socket event gönderme de MessagingService içinde SocketHandler kullanılarak yapılır.

## 📚 İlgili Dokümantasyon

- [MESSAGING_SOCKET_EVENTS.md](./MESSAGING_SOCKET_EVENTS.md) - Tüm socket event'lerinin listesi
- [SOCKET_IO_INTEGRATION.md](./SOCKET_IO_INTEGRATION.md) - Backend socket entegrasyonu
- [SOCKET_INTEGRATION_SUMMARY.md](./SOCKET_INTEGRATION_SUMMARY.md) - Socket entegrasyon özeti

