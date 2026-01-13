import { io, Socket } from 'socket.io-client';
import axios from 'axios';

const BASE_URL = 'http://localhost:3000';
const SOCKET_URL = 'http://localhost:3000';
const JULIA_EMAIL = 'julia.havk@tipbox.co';
const JULIA_PASSWORD = 'password123';

let socket: Socket | null = null;

async function login(): Promise<{ token: string; userId: string }> {
  console.log('🔐 Julia Havk ile login yapılıyor...');
  const response = await axios.post(`${BASE_URL}/auth/login`, {
    email: JULIA_EMAIL,
    password: JULIA_PASSWORD,
  });
  
  const token = response.data.token;
  const userId = response.data.id;
  console.log(`✓ Login başarılı - User ID: ${userId}\n`);
  return { token, userId };
}

function connectSocket(token: string, userId: string): Promise<Socket> {
  return new Promise((resolve, reject) => {
    console.log('🔌 Socket.IO bağlantısı kuruluyor...');
    
    socket = io(SOCKET_URL, {
      auth: {
        token: token,
      },
      transports: ['websocket', 'polling'],
      path: '/socket.io/',
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: Infinity,
    });

    socket.on('connect', () => {
      console.log('✅ Socket bağlantısı kuruldu!');
      console.log(`   Socket ID: ${socket?.id}\n`);
      resolve(socket!);
    });

    socket.on('connected', (data: any) => {
      console.log('✅ Server bağlantı onayı alındı!');
      console.log(`   Message: ${data.message}`);
      console.log(`   User ID: ${data.userId}`);
      console.log(`   User Email: ${data.userEmail}\n`);
    });

    socket.on('connect_error', (error: any) => {
      console.error('❌ Socket bağlantı hatası:', error.message);
      reject(error);
    });

    socket.on('disconnect', (reason: string) => {
      console.log(`\n⚠️  Socket bağlantısı kesildi: ${reason}`);
    });
  });
}

function setupMessageListeners(socket: Socket, userId: string) {
  console.log('👂 Mesaj dinleyicileri kuruluyor...\n');
  console.log('═══════════════════════════════════════════════════════');
  console.log('📬 REALTIME MESAJ DİNLEYİCİSİ AKTİF');
  console.log('═══════════════════════════════════════════════════════');
  console.log('Julia Havk\'a gelen mesajlar burada görünecek...\n');

  // Yeni mesaj geldiğinde
  socket.on('new_message', (event: any) => {
    console.log('\n📨 YENİ MESAJ GELDİ!');
    console.log('───────────────────────────────────────────────────────');
    console.log(`📤 Gönderen ID: ${event.senderId}`);
    console.log(`📥 Alıcı ID: ${event.recipientId}`);
    console.log(`💬 Mesaj: ${event.message}`);
    console.log(`📋 Mesaj Tipi: ${event.messageType || 'message'}`);
    console.log(`🔖 Context: ${event.context || 'DM'}`);
    console.log(`🕐 Zaman: ${new Date(event.timestamp).toLocaleString('tr-TR')}`);
    if (event.threadId) {
      console.log(`🧵 Thread ID: ${event.threadId}`);
    }
    console.log('───────────────────────────────────────────────────────\n');
  });

  // Mesaj gönderildi onayı
  socket.on('message_sent', (event: any) => {
    console.log('✅ Mesaj gönderildi onayı alındı');
    console.log(`   Thread ID: ${event.threadId || 'N/A'}`);
    console.log(`   Mesaj: ${event.message?.substring(0, 50)}...\n`);
  });

  // Mesaj okundu
  socket.on('message_read', (event: any) => {
    console.log('👁️  Mesaj okundu');
    console.log(`   Message ID: ${event.messageId}`);
    console.log(`   Thread ID: ${event.threadId}`);
    console.log(`   Okundu: ${new Date(event.timestamp).toLocaleString('tr-TR')}\n`);
  });

  // Thread okundu
  socket.on('thread_read', (event: any) => {
    console.log('👁️  Thread okundu');
    console.log(`   Thread ID: ${event.threadId}`);
    console.log(`   Okundu: ${new Date(event.timestamp).toLocaleString('tr-TR')}\n`);
  });

  // Kullanıcı yazıyor
  socket.on('user_typing', (event: any) => {
    if (event.isTyping) {
      console.log(`⌨️  Kullanıcı yazıyor... (Thread: ${event.threadId})`);
    } else {
      console.log(`⌨️  Kullanıcı yazmayı durdurdu (Thread: ${event.threadId})\n`);
    }
  });

  // Thread'e katıldı
  socket.on('thread_joined', (event: any) => {
    console.log(`🚪 Thread'e katıldı: ${event.threadId}\n`);
  });

  // Thread'den ayrıldı
  socket.on('thread_left', (event: any) => {
    console.log(`🚪 Thread'den ayrıldı: ${event.threadId}\n`);
  });

  // Support request accepted
  socket.on('support_request_accepted', (event: any) => {
    console.log('✅ Support request kabul edildi');
    console.log(`   Request ID: ${event.requestId}`);
    console.log(`   Thread ID: ${event.threadId}\n`);
  });

  // Support request rejected
  socket.on('support_request_rejected', (event: any) => {
    console.log('❌ Support request reddedildi');
    console.log(`   Request ID: ${event.requestId}\n`);
  });

  // Support request cancelled
  socket.on('support_request_cancelled', (event: any) => {
    console.log('🚫 Support request iptal edildi');
    console.log(`   Request ID: ${event.requestId}\n`);
  });

  // Hata
  socket.on('error', (error: any) => {
    console.error('❌ Socket hatası:', error.message || error);
  });

  // Ping-pong
  socket.on('pong', () => {
    // Sessizce ping-pong yapıyoruz
  });

  console.log('✅ Tüm event listener\'lar kuruldu\n');
}

async function main() {
  try {
    // Login
    const { token, userId } = await login();

    // Socket bağlantısı kur
    const socketInstance = await connectSocket(token, userId);

    // Mesaj dinleyicilerini kur
    setupMessageListeners(socketInstance, userId);

    // Inbox listesini yükle
    console.log('📋 Inbox listesi yükleniyor...');
    try {
      const inboxResponse = await axios.get(`${BASE_URL}/messages`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      
      const threads = inboxResponse.data || [];
      console.log(`✓ ${threads.length} thread bulundu\n`);
      
      if (threads.length > 0) {
        console.log('📋 Mevcut Thread\'ler:');
        threads.slice(0, 5).forEach((thread: any, index: number) => {
          console.log(`   ${index + 1}. ${thread.senderName || 'Bilinmeyen'} - ${thread.lastMessage?.substring(0, 30) || 'Mesaj yok'}...`);
        });
        console.log('');
      }
    } catch (error) {
      console.log('⚠️  Inbox listesi yüklenemedi\n');
    }

    console.log('═══════════════════════════════════════════════════════');
    console.log('🎯 REALTIME MESAJ DİNLEYİCİSİ HAZIR');
    console.log('═══════════════════════════════════════════════════════');
    console.log('Julia Havk\'a gelen tüm mesajlar burada görünecek.');
    console.log('Çıkmak için Ctrl+C tuşlarına basın.\n');

    // Process exit handler
    process.on('SIGINT', () => {
      console.log('\n\n🔌 Bağlantı kapatılıyor...');
      if (socket) {
        socket.disconnect();
      }
      console.log('✅ Çıkış yapıldı');
      process.exit(0);
    });

    // Keep process alive
    process.stdin.resume();

  } catch (error: any) {
    console.error('❌ Hata:', error.message);
    if (socket) {
      socket.disconnect();
    }
    process.exit(1);
  }
}

main();








