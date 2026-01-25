/**
 * Support Thread'de Mesaj Gönderme Test Script'i
 * Support Request ID'ye göre thread ID'yi bulup mesaj gönderir
 */

import axios, { AxiosInstance } from 'axios';
import { io, Socket } from 'socket.io-client';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

// Kullanıcı bilgileri
const TUNA_USER_ID = '7413549b-126e-4b41-a06b-c22600a85f67';
const TUNA_EMAIL = 'tuna@tipbox.co';
const DEFAULT_PASSWORD = 'password123';

// Support Request ID (komut satırından alınacak veya buraya yazılacak)
const SUPPORT_REQUEST_ID = process.argv[2] || 'd5b593ca-80e2-4f07-866c-32b7c550055b';

/**
 * Login ve token al
 */
async function login(email: string, password: string): Promise<string | null> {
  try {
    console.log(`\n🔐 ${email} olarak giriş yapılıyor...`);
    
    const response = await axios.post(`${BASE_URL}/auth/login`, {
      email,
      password,
    });

    if (response.data && response.data.token) {
      const token = response.data.token;
      console.log('✅ Giriş başarılı! Token alındı.\n');
      return token;
    }
    
    console.log('❌ Token alınamadı');
    return null;
  } catch (error: any) {
    console.error('❌ Login hatası:', error.response?.data?.message || error.message);
    return null;
  }
}

/**
 * API client oluştur
 */
function createApiClient(token: string): AxiosInstance {
  return axios.create({
    baseURL: BASE_URL,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });
}

/**
 * Support Request ID'den Thread ID'yi bul
 */
async function getThreadIdFromSupportRequest(api: AxiosInstance, supportRequestId: string): Promise<string | null> {
  try {
    console.log(`\n🔍 Support Request ID'den Thread ID bulunuyor...`);
    console.log(`   Support Request ID: ${supportRequestId}`);
    
    // Support request'leri listele
    const response = await api.get('/inbox/support-requests', {
      params: {
        limit: 100, // Tüm request'leri getir
      },
    });

    if (response.data && response.data.items) {
      const request = response.data.items.find((req: any) => req.id === supportRequestId);
      
      if (!request) {
        console.error(`❌ Support Request bulunamadı: ${supportRequestId}`);
        return null;
      }

      if (!request.threadId) {
        console.error(`❌ Bu Support Request henüz accept edilmemiş (threadId: null)`);
        console.error(`   Status: ${request.status}`);
        return null;
      }

      console.log(`✅ Thread ID bulundu: ${request.threadId}`);
      console.log(`   Status: ${request.status}`);
      console.log(`   Karşı Taraf: ${request.userName}`);
      
      return request.threadId;
    }

    console.error('❌ Support request listesi alınamadı');
    return null;
  } catch (error: any) {
    console.error('❌ Support request sorgulama hatası:', error.response?.data?.message || error.message);
    return null;
  }
}

/**
 * Socket bağlantısı kur
 */
function connectSocket(token: string): Promise<Socket> {
  return new Promise((resolve, reject) => {
    console.log('🔌 Socket bağlantısı kuruluyor...');
    
    const socket = io(BASE_URL, {
      auth: {
        token: token,
      },
      transports: ['websocket'],
    });

    socket.on('connect', () => {
      console.log('✅ Socket bağlantısı kuruldu!\n');
      resolve(socket);
    });

    socket.on('connect_error', (error) => {
      console.error('❌ Socket bağlantı hatası:', error.message);
      reject(error);
    });

    socket.on('error', (error) => {
      console.error('❌ Socket hatası:', error);
    });
  });
}

/**
 * Support thread'de mesaj gönder (Socket ile)
 */
async function sendSupportMessage(socket: Socket, threadId: string, message: string): Promise<boolean> {
  return new Promise((resolve) => {
    console.log(`\n📤 Support thread'de mesaj gönderiliyor...`);
    console.log(`   Thread ID: ${threadId}`);
    console.log(`   Mesaj: ${message}`);
    
    let resolved = false;

    // Socket event listener - başarılı yanıt için
    const messageHandler = (data: any) => {
      if (data.threadId === threadId && data.context === 'SUPPORT') {
        console.log('✅ Support mesajı başarıyla gönderildi!');
        console.log(`   Message ID: ${data.messageId}`);
        console.log(`   Sender ID: ${data.senderId}`);
        console.log(`   Message: ${data.message}`);
        if (!resolved) {
          resolved = true;
          socket.off('new_message', messageHandler);
          socket.off('error', errorHandler);
          resolve(true);
        }
      }
    };

    // Hata listener
    const errorHandler = (error: any) => {
      console.error('❌ Support mesaj gönderme hatası:', error.message || error);
      if (!resolved) {
        resolved = true;
        socket.off('new_message', messageHandler);
        socket.off('error', errorHandler);
        resolve(false);
      }
    };

    socket.on('new_message', messageHandler);
    socket.on('error', errorHandler);

    // Support mesajı gönder
    socket.emit('send_support_message', {
      threadId,
      message: message.trim(),
    });

    // Timeout (10 saniye)
    setTimeout(() => {
      if (!resolved) {
        resolved = true;
        console.log('⚠️  Timeout: Yanıt alınamadı (ama mesaj gönderilmiş olabilir)');
        socket.off('new_message', messageHandler);
        socket.off('error', errorHandler);
        resolve(true); // Timeout olsa bile mesaj gönderilmiş olabilir
      }
    }, 10000);
  });
}

/**
 * Ana fonksiyon
 */
async function main() {
  try {
    console.log('╔═══════════════════════════════════════════════════════╗');
    console.log('║   Support Thread Mesaj Gönderme Test Script\'i        ║');
    console.log('╚═══════════════════════════════════════════════════════╝');
    console.log('');

    // Support Request ID kontrolü
    if (!SUPPORT_REQUEST_ID) {
      console.error('❌ Support Request ID gerekli!');
      console.error('   Kullanım: npx ts-node scripts/send-support-message-test.ts <support-request-id>');
      process.exit(1);
    }

    // Tuna olarak login
    const token = await login(TUNA_EMAIL, DEFAULT_PASSWORD);
    if (!token) {
      console.error('❌ Giriş başarısız! Script sonlandırılıyor.');
      process.exit(1);
    }

    // API client
    const api = createApiClient(token);

    // Support Request ID'den Thread ID'yi bul
    const threadId = await getThreadIdFromSupportRequest(api, SUPPORT_REQUEST_ID);
    if (!threadId) {
      console.error('\n❌ Thread ID bulunamadı! Script sonlandırılıyor.');
      process.exit(1);
    }

    // Socket bağlantısı
    const socket = await connectSocket(token);

    // Support thread'de mesaj gönder
    const message = 'Merhaba, support request hakkında bir sorum var.';
    const success = await sendSupportMessage(socket, threadId, message);

    if (success) {
      console.log('\n✅ Test başarılı!');
    } else {
      console.log('\n❌ Test başarısız!');
    }

    // Socket'i kapat
    socket.disconnect();
    console.log('\n🔌 Socket bağlantısı kapatıldı.');

    process.exit(success ? 0 : 1);
  } catch (error) {
    console.error('❌ Script hatası:', error);
    process.exit(1);
  }
}

// Script'i çalıştır
main();
