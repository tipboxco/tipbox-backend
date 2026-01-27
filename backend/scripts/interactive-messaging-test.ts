/**
 * Interaktif Mesajlaşma Test Script'i
 * 
 * Tuna ve Omer kullanıcıları arasında tüm mesajlaşma senaryolarını test eder.
 * REST API ve Socket.IO event'lerini kapsar.
 * 
 * Kullanım:
 *   npm run test:messaging
 *   veya
 *   docker exec -it tipbox_backend npm run test:messaging
 */

import { io, Socket } from 'socket.io-client';
import axios, { AxiosInstance } from 'axios';
import * as readline from 'readline';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

// Environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

// Constants
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const TUNA_USER_ID = '7413549b-126e-4b41-a06b-c22600a85f67';
const OMER_USER_ID = '480f5de9-b691-4d70-a6a8-2789226f4e07';
const TUNA_EMAIL = 'tuna@tipbox.co';
const OMER_EMAIL = 'omer@tipbox.co';
const DEFAULT_PASSWORD = 'password123';

// Color codes for terminal
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

// Test State
interface TestState {
  tunaToken?: string;
  omerToken?: string;
  tunaSocket?: Socket;
  omerSocket?: Socket;
  currentThreadId?: string;
  currentSupportThreadId?: string;
  lastMessageIds: string[];
  lastSupportRequestId?: string;
  lastReactionId?: string;
  currentUser: 'tuna' | 'omer' | null;
}

const state: TestState = {
  lastMessageIds: [],
  currentUser: null,
};

// Readline interface
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

/**
 * Kullanıcıdan input al
 */
function question(prompt: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

/**
 * Renkli log fonksiyonları
 */
const log = {
  info: (msg: string) => console.log(`${colors.cyan}ℹ️  ${msg}${colors.reset}`),
  success: (msg: string) => console.log(`${colors.green}✅ ${msg}${colors.reset}`),
  error: (msg: string) => console.log(`${colors.red}❌ ${msg}${colors.reset}`),
  warning: (msg: string) => console.log(`${colors.yellow}⚠️  ${msg}${colors.reset}`),
  title: (msg: string) => console.log(`${colors.bright}${colors.blue}${msg}${colors.reset}`),
};

/**
 * Login ve token al
 */
async function login(userId: string, email: string): Promise<string | null> {
  try {
    log.info(`${email} olarak giriş yapılıyor...`);
    
    const response = await axios.post(`${BASE_URL}/auth/login`, {
      email,
      password: DEFAULT_PASSWORD,
    });

    if (response.data && response.data.token) {
      const token = response.data.token;
      log.success(`Giriş başarılı! Token alındı.`);
      return token;
    }

    log.error('Token alınamadı');
    return null;
  } catch (error: any) {
    log.error(`Giriş hatası: ${error.response?.data?.message || error.message}`);
    return null;
  }
}

/**
 * Socket.IO bağlantısı kur
 */
async function connectSocket(token: string, userName: string): Promise<Socket | null> {
  return new Promise((resolve) => {
    log.info(`${userName} için Socket.IO bağlantısı kuruluyor...`);
    
    const socket = io(BASE_URL, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
    });

    socket.on('connect', () => {
      log.success(`Socket.IO bağlantısı kuruldu! (${userName})`);
      resolve(socket);
    });

    socket.on('connect_error', (error) => {
      log.error(`Socket bağlantı hatası: ${error.message}`);
      resolve(null);
    });

    socket.on('disconnect', (reason) => {
      log.warning(`Socket bağlantısı kesildi: ${reason}`);
    });

    // Socket event'lerini dinle
    socket.on('new_message', (data) => {
      log.info(`📨 Yeni mesaj geldi: ${JSON.stringify(data, null, 2)}`);
    });

    socket.on('message_sent', (data) => {
      log.success(`📤 Mesaj gönderildi: ${data.messageId}`);
    });

    socket.on('message_read', (data) => {
      log.info(`👁️  Mesaj okundu: ${data.messageId} by ${data.readBy}`);
    });

    socket.on('thread_read', (data) => {
      log.info(`👁️  Thread okundu: ${data.threadId} by ${data.readBy}`);
    });

    socket.on('user_typing', (data) => {
      log.info(`⌨️  Kullanıcı yazıyor: ${data.userId} in thread ${data.threadId}`);
    });

    socket.on('support_request_accepted', (data) => {
      log.success(`✅ Support request accept edildi: ${data.requestId}, threadId: ${data.threadId}`);
      if (data.threadId) {
        state.currentSupportThreadId = data.threadId;
      }
    });

    socket.on('support_request_rejected', (data) => {
      log.warning(`❌ Support request reject edildi: ${data.requestId}`);
    });

    socket.on('support_request_cancelled', (data) => {
      log.warning(`🚫 Support request iptal edildi: ${data.requestId}`);
    });

    socket.on('support_request_closed', (data) => {
      log.success(`🔒 Support request kapatıldı: ${data.requestId}`);
    });

    socket.on('support_request_reported', (data) => {
      log.warning(`🚨 Support request raporlandı: ${data.requestId}`);
    });

    socket.on('error', (error) => {
      log.error(`Socket hatası: ${error.message || JSON.stringify(error)}`);
    });
  });
}

/**
 * API client oluştur
 */
function createApiClient(token: string): AxiosInstance {
  return axios.create({
    baseURL: BASE_URL,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });
}

/**
 * Test görseli oluştur - belirtilen görseli kullan
 */
function createTestImage(): Buffer {
  try {
    // Belirtilen görseli oku (backend/src/Explore Banners/Tipbox-explorebanners.png)
    const imagePath = path.resolve(process.cwd(), 'src/Explore Banners/Tipbox-explorebanners.png');
    log.info(`Görsel okunuyor: ${imagePath}`);
    
    if (fs.existsSync(imagePath)) {
      const imageBuffer = fs.readFileSync(imagePath);
      log.success(`Görsel başarıyla okundu (${imageBuffer.length} bytes)`);
      return imageBuffer;
    } else {
      // Fallback: Minimal 1x1 pixel PNG (base64)
      log.warning('Görsel bulunamadı, test görseli kullanılıyor: ' + imagePath);
      const pngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
      return Buffer.from(pngBase64, 'base64');
    }
  } catch (error: any) {
    log.error('Görsel okuma hatası: ' + error.message);
    // Fallback: Minimal 1x1 pixel PNG (base64)
    const pngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    return Buffer.from(pngBase64, 'base64');
  }
}

/**
 * Senaryo 1: Text Mesaj Gönder
 */
async function sendTextMessage(api: AxiosInstance, recipientId: string): Promise<string | null> {
  try {
    const message = await question('📝 Mesaj içeriği: ');
    if (!message.trim()) {
      log.error('Mesaj boş olamaz!');
      return null;
    }

    log.info('Mesaj gönderiliyor...');
    const response = await api.post('/inbox', {
      recipientUserId: recipientId,
      message: message.trim(),
    });

    if (response.status === 201) {
      log.success('Mesaj başarıyla gönderildi!');
      
      // Thread ID'yi al (eğer response'da varsa)
      if (response.data.threadId) {
        state.currentThreadId = response.data.threadId;
      }
      
      return response.data.messageId || 'unknown';
    }
    
    return null;
  } catch (error: any) {
    log.error(`Mesaj gönderme hatası: ${error.response?.data?.message || error.message}`);
    return null;
  }
}

/**
 * Senaryo 2: Görsel Mesaj Gönder
 */
async function sendImageMessage(api: AxiosInstance, recipientId: string): Promise<string | null> {
  try {
    const caption = await question('📝 Caption (opsiyonel, Enter ile geç): ');
    
    log.info('Görsel oluşturuluyor ve yükleniyor...');
    
    // Test görseli oluştur
    const imageBuffer = createTestImage();
    
    // FormData kullan (Node.js built-in değil, paket gerekli)
    // Alternatif: axios ile multipart/form-data gönder
    const FormData = require('form-data');
    const formData = new (FormData as any)();
    
    formData.append('recipientUserId', recipientId);
    if (caption.trim()) {
      formData.append('message', caption.trim());
    }
    formData.append('media', imageBuffer, {
      filename: 'Tipbox-explorebanners.png',
      contentType: 'image/png',
    });

    const response = await axios.post(`${BASE_URL}/inbox`, formData, {
      headers: {
        ...formData.getHeaders(),
        Authorization: api.defaults.headers.common['Authorization'] as string,
      },
    });

    if (response.status === 201) {
      log.success('Görsel mesaj başarıyla gönderildi!');
      log.info(`Media URL: ${response.data.mediaUrl || 'N/A'}`);
      
      if (response.data.threadId) {
        state.currentThreadId = response.data.threadId;
      }
      
      return response.data.messageId || 'unknown';
    }
    
    return null;
  } catch (error: any) {
    log.error(`Görsel gönderme hatası: ${error.response?.data?.message || error.message}`);
    return null;
  }
}

/**
 * Senaryo 3: Mesaj Sil
 */
async function deleteMessage(api: AxiosInstance): Promise<boolean> {
  try {
    if (state.lastMessageIds.length === 0) {
      log.error('Silinecek mesaj bulunamadı. Önce mesaj gönderin.');
      return false;
    }

    log.info(`Son ${state.lastMessageIds.length} mesaj:`);
    state.lastMessageIds.forEach((id, index) => {
      console.log(`  ${index + 1}. ${id}`);
    });

    const choice = await question('Hangi mesajı silmek istersiniz? (numara): ');
    const index = parseInt(choice) - 1;
    
    if (index < 0 || index >= state.lastMessageIds.length) {
      log.error('Geçersiz seçim!');
      return false;
    }

    const messageId = state.lastMessageIds[index];
    log.info(`Mesaj siliniyor: ${messageId}...`);

    const response = await api.delete(`/inbox/${messageId}`);

    if (response.status === 200 || response.status === 204) {
      log.success('Mesaj başarıyla silindi!');
      state.lastMessageIds.splice(index, 1);
      return true;
    }
    
    return false;
  } catch (error: any) {
    log.error(`Mesaj silme hatası: ${error.response?.data?.message || error.message}`);
    return false;
  }
}

/**
 * Senaryo 4: Mesaj Düzenle
 */
async function editMessage(api: AxiosInstance): Promise<boolean> {
  try {
    if (state.lastMessageIds.length === 0) {
      log.error('Düzenlenecek mesaj bulunamadı. Önce mesaj gönderin.');
      return false;
    }

    log.info(`Son ${state.lastMessageIds.length} mesaj:`);
    state.lastMessageIds.forEach((id, index) => {
      console.log(`  ${index + 1}. ${id}`);
    });

    const choice = await question('Hangi mesajı düzenlemek istersiniz? (numara): ');
    const index = parseInt(choice) - 1;
    
    if (index < 0 || index >= state.lastMessageIds.length) {
      log.error('Geçersiz seçim!');
      return false;
    }

    const messageId = state.lastMessageIds[index];
    const newMessage = await question('Yeni mesaj içeriği: ');

    if (!newMessage.trim()) {
      log.error('Mesaj boş olamaz!');
      return false;
    }

    log.info(`Mesaj düzenleniyor: ${messageId}...`);

    const response = await api.patch(`/inbox/${messageId}`, {
      message: newMessage.trim(),
    });

    if (response.status === 200) {
      log.success('Mesaj başarıyla düzenlendi!');
      return true;
    }
    
    return false;
  } catch (error: any) {
    log.error(`Mesaj düzenleme hatası: ${error.response?.data?.message || error.message}`);
    return false;
  }
}

/**
 * Senaryo 5: Reaction Ekle
 */
async function addReaction(api: AxiosInstance): Promise<boolean> {
  try {
    if (state.lastMessageIds.length === 0) {
      log.error('Reaction eklemek için mesaj bulunamadı. Önce mesaj gönderin.');
      return false;
    }

    log.info(`Son ${state.lastMessageIds.length} mesaj:`);
    state.lastMessageIds.forEach((id, index) => {
      console.log(`  ${index + 1}. ${id}`);
    });

    const choice = await question('Hangi mesaja reaction eklemek istersiniz? (numara): ');
    const index = parseInt(choice) - 1;
    
    if (index < 0 || index >= state.lastMessageIds.length) {
      log.error('Geçersiz seçim!');
      return false;
    }

    const messageId = state.lastMessageIds[index];
    console.log('\nEmoji seçenekleri:');
    console.log('  1. 👍 (thumbs up)');
    console.log('  2. ❤️ (heart)');
    console.log('  3. 😂 (laughing)');
    console.log('  4. 🔥 (fire)');
    console.log('  5. 👏 (clap)');
    console.log('  6. Özel emoji girin');
    
    const emojiChoice = await question('Emoji seçin (1-6): ');
    
    let emoji = '';
    switch (emojiChoice) {
      case '1': emoji = '👍'; break;
      case '2': emoji = '❤️'; break;
      case '3': emoji = '😂'; break;
      case '4': emoji = '🔥'; break;
      case '5': emoji = '👏'; break;
      case '6': 
        emoji = await question('Emoji girin: ');
        break;
      default:
        log.error('Geçersiz seçim!');
        return false;
    }

    log.info(`Reaction ekleniyor: ${emoji} to message ${messageId}...`);

    const response = await api.post(`/inbox/${messageId}/reactions`, {
      emoji: emoji.trim(),
    });

    if (response.status === 201) {
      log.success('Reaction başarıyla eklendi!');
      if (response.data.reactionId) {
        state.lastReactionId = response.data.reactionId;
      }
      return true;
    }
    
    return false;
  } catch (error: any) {
    log.error(`Reaction ekleme hatası: ${error.response?.data?.message || error.message}`);
    return false;
  }
}

/**
 * Senaryo 6: Reaction Sil
 */
async function removeReaction(api: AxiosInstance): Promise<boolean> {
  try {
    if (!state.lastReactionId) {
      log.error('Silinecek reaction bulunamadı. Önce reaction ekleyin.');
      return false;
    }

    if (state.lastMessageIds.length === 0) {
      log.error('Mesaj bulunamadı.');
      return false;
    }

    log.info(`Son mesaj: ${state.lastMessageIds[0]}`);
    log.info(`Son reaction ID: ${state.lastReactionId}`);

    const confirm = await question('Reaction silinsin mi? (e/h): ');
    if (confirm.toLowerCase() !== 'e') {
      return false;
    }

    log.info(`Reaction siliniyor: ${state.lastReactionId}...`);

    const response = await api.delete(`/inbox/${state.lastMessageIds[0]}/reactions/${state.lastReactionId}`);

    if (response.status === 200) {
      log.success('Reaction başarıyla silindi!');
      state.lastReactionId = undefined;
      return true;
    }
    
    return false;
  } catch (error: any) {
    log.error(`Reaction silme hatası: ${error.response?.data?.message || error.message}`);
    return false;
  }
}

/**
 * Senaryo 7: Reactions Listele
 */
async function listReactions(api: AxiosInstance): Promise<boolean> {
  try {
    if (state.lastMessageIds.length === 0) {
      log.error('Mesaj bulunamadı. Önce mesaj gönderin.');
      return false;
    }

    const messageId = state.lastMessageIds[0];
    log.info(`Reactions getiriliyor: ${messageId}...`);

    const response = await api.get(`/inbox/${messageId}/reactions`);

    if (response.status === 200) {
      log.success('Reactions başarıyla getirildi!');
      console.log(JSON.stringify(response.data, null, 2));
      return true;
    }
    
    return false;
  } catch (error: any) {
    log.error(`Reactions listeleme hatası: ${error.response?.data?.message || error.message}`);
    return false;
  }
}

/**
 * Senaryo 8: Typing Start
 */
async function typingStart(socket: Socket | null): Promise<boolean> {
  try {
    if (!socket) {
      log.error('Socket bağlantısı yok!');
      return false;
    }

    if (!state.currentThreadId) {
      log.error('Thread ID bulunamadı. Önce thread oluşturun veya mesaj gönderin.');
      return false;
    }

    log.info(`Typing start gönderiliyor: thread ${state.currentThreadId}...`);
    socket.emit('typing_start', { threadId: state.currentThreadId });
    log.success('Typing start event gönderildi!');
    return true;
  } catch (error: any) {
    log.error(`Typing start hatası: ${error.message}`);
    return false;
  }
}

/**
 * Senaryo 9: Typing Stop
 */
async function typingStop(socket: Socket | null): Promise<boolean> {
  try {
    if (!socket) {
      log.error('Socket bağlantısı yok!');
      return false;
    }

    if (!state.currentThreadId) {
      log.error('Thread ID bulunamadı.');
      return false;
    }

    log.info(`Typing stop gönderiliyor: thread ${state.currentThreadId}...`);
    socket.emit('typing_stop', { threadId: state.currentThreadId });
    log.success('Typing stop event gönderildi!');
    return true;
  } catch (error: any) {
    log.error(`Typing stop hatası: ${error.message}`);
    return false;
  }
}

/**
 * Senaryo 10: Thread Mesajlarını Getir
 */
async function getThreadMessages(api: AxiosInstance): Promise<boolean> {
  try {
    let threadId = state.currentThreadId;
    
    if (!threadId) {
      threadId = await question('Thread ID girin (Enter ile son thread): ');
      if (!threadId) {
        log.error('Thread ID gerekli!');
        return false;
      }
    }

    log.info(`Thread mesajları getiriliyor: ${threadId}...`);

    const response = await api.get(`/inbox/${threadId}`);

    if (response.status === 200) {
      log.success('Thread mesajları başarıyla getirildi!');
      console.log(`\n📋 Participants:`);
      if (response.data.participants) {
        console.log(`  User One: ${response.data.participants.userOne.name} (${response.data.participants.userOne.id})`);
        console.log(`  User Two: ${response.data.participants.userTwo.name} (${response.data.participants.userTwo.id})`);
      }
      console.log(`\n📨 Mesajlar (${response.data.items?.length || 0} adet):`);
      response.data.items?.forEach((item: any, index: number) => {
        console.log(`\n  ${index + 1}. [${item.type}] ${item.id}`);
        if (item.type === 'message' || item.type === 'image') {
          console.log(`     Sender: ${item.data.senderId || item.data.sender?.id}`);
          console.log(`     Message: ${item.data.message || item.data.caption || 'N/A'}`);
          if (item.type === 'image') {
            console.log(`     Media URL: ${item.data.mediaUrl || 'N/A'}`);
          }
        }
      });
      console.log(`\n📄 Pagination: hasMore=${response.data.pagination?.hasMore}, cursor=${response.data.pagination?.cursor || 'N/A'}`);
      return true;
    }
    
    return false;
  } catch (error: any) {
    log.error(`Thread mesajları getirme hatası: ${error.response?.data?.message || error.message}`);
    return false;
  }
}

/**
 * Senaryo 11: Thread Sil
 */
async function deleteThread(api: AxiosInstance): Promise<boolean> {
  try {
    let threadId = state.currentThreadId;
    
    if (!threadId) {
      threadId = await question('Thread ID girin: ');
      if (!threadId) {
        log.error('Thread ID gerekli!');
        return false;
      }
    }

    const confirm = await question(`Thread silinsin mi? (${threadId}) (e/h): `);
    if (confirm.toLowerCase() !== 'e') {
      return false;
    }

    log.info(`Thread siliniyor: ${threadId}...`);

    const response = await api.delete(`/inbox/threads/${threadId}`);

    if (response.status === 204 || response.status === 200) {
      log.success('Thread başarıyla silindi!');
      if (state.currentThreadId === threadId) {
        state.currentThreadId = undefined;
      }
      return true;
    }
    
    return false;
  } catch (error: any) {
    log.error(`Thread silme hatası: ${error.response?.data?.message || error.message}`);
    return false;
  }
}

/**
 * Senaryo 12: Thread Ara
 */
async function searchThread(api: AxiosInstance): Promise<boolean> {
  try {
    let threadId = state.currentThreadId;
    
    if (!threadId) {
      threadId = await question('Thread ID girin: ');
      if (!threadId) {
        log.error('Thread ID gerekli!');
        return false;
      }
    }

    const query = await question('Arama sorgusu: ');
    if (!query.trim()) {
      log.error('Arama sorgusu boş olamaz!');
      return false;
    }

    log.info(`Thread'de arama yapılıyor: "${query}" in ${threadId}...`);

    const response = await api.get(`/inbox/threads/${threadId}/search`, {
      params: { q: query.trim() },
    });

    if (response.status === 200) {
      log.success('Arama sonuçları getirildi!');
      console.log(JSON.stringify(response.data, null, 2));
      return true;
    }
    
    return false;
  } catch (error: any) {
    log.error(`Thread arama hatası: ${error.response?.data?.message || error.message}`);
    return false;
  }
}

/**
 * Senaryo 13: Support Request Oluştur
 */
async function createSupportRequest(api: AxiosInstance, senderId: string, recipientId: string): Promise<boolean> {
  try {
    console.log('\nSupport Request Tipi:');
    console.log('  1. GENERAL');
    console.log('  2. TECHNICAL');
    console.log('  3. PRODUCT');
    
    const typeChoice = await question('Tip seçin (1-3): ');
    let type = 'GENERAL';
    switch (typeChoice) {
      case '1': type = 'GENERAL'; break;
      case '2': type = 'TECHNICAL'; break;
      case '3': type = 'PRODUCT'; break;
      default:
        log.error('Geçersiz seçim!');
        return false;
    }

    const message = await question('Mesaj: ');
    if (!message.trim()) {
      log.error('Mesaj boş olamaz!');
      return false;
    }

    const amountStr = await question('TIPS miktarı: ');
    const amount = parseFloat(amountStr);
    if (isNaN(amount) || amount < 0) {
      log.error('Geçersiz miktar!');
      return false;
    }

    log.info('Support request oluşturuluyor...');

    const response = await api.post('/inbox/support-requests', {
      senderUserId: senderId,
      recipientUserId: recipientId,
      type,
      message: message.trim(),
      amount: amount.toString(),
      status: 'pending',
      timestamp: new Date().toISOString(),
    });

    if (response.status === 201) {
      log.success('Support request başarıyla oluşturuldu!');
      log.info(`Request ID: ${response.data.id || response.data.requestId}`);
      if (response.data.id) {
        state.lastSupportRequestId = response.data.id;
      } else if (response.data.requestId) {
        state.lastSupportRequestId = response.data.requestId;
      }
      return true;
    }
    
    return false;
  } catch (error: any) {
    log.error(`Support request oluşturma hatası: ${error.response?.data?.message || error.message}`);
    return false;
  }
}

/**
 * Senaryo 14: Support Request Accept
 */
async function acceptSupportRequest(api: AxiosInstance, socket: Socket | null): Promise<boolean> {
  try {
    let requestId = state.lastSupportRequestId;
    
    if (!requestId) {
      requestId = await question('Support Request ID girin: ');
      if (!requestId) {
        log.error('Request ID gerekli!');
        return false;
      }
    }

    log.info(`Support request accept ediliyor: ${requestId}...`);

    // REST API ile
    const response = await api.post(`/inbox/support-requests/${requestId}/accept`);

    if (response.status === 200) {
      log.success('Support request başarıyla accept edildi!');
      if (response.data.threadId) {
        state.currentSupportThreadId = response.data.threadId;
        log.info(`Support Thread ID: ${response.data.threadId}`);
      }
      
      // Socket ile de gönder (test için)
      if (socket) {
        socket.emit('accept_support_request', { requestId });
      }
      
      return true;
    }
    
    return false;
  } catch (error: any) {
    log.error(`Support request accept hatası: ${error.response?.data?.message || error.message}`);
    return false;
  }
}

/**
 * Senaryo 15: Support Request Reject
 */
async function rejectSupportRequest(api: AxiosInstance, socket: Socket | null): Promise<boolean> {
  try {
    let requestId = state.lastSupportRequestId;
    
    if (!requestId) {
      requestId = await question('Support Request ID girin: ');
      if (!requestId) {
        log.error('Request ID gerekli!');
        return false;
      }
    }

    log.info(`Support request reject ediliyor: ${requestId}...`);

    const response = await api.post(`/inbox/support-requests/${requestId}/reject`);

    if (response.status === 200) {
      log.success('Support request başarıyla reject edildi!');
      
      if (socket) {
        socket.emit('reject_support_request', { requestId });
      }
      
      return true;
    }
    
    return false;
  } catch (error: any) {
    log.error(`Support request reject hatası: ${error.response?.data?.message || error.message}`);
    return false;
  }
}

/**
 * Senaryo 16: Support Request Cancel
 */
async function cancelSupportRequest(api: AxiosInstance, socket: Socket | null): Promise<boolean> {
  try {
    let requestId = state.lastSupportRequestId;
    
    if (!requestId) {
      requestId = await question('Support Request ID girin: ');
      if (!requestId) {
        log.error('Request ID gerekli!');
        return false;
      }
    }

    log.info(`Support request iptal ediliyor: ${requestId}...`);

    const response = await api.post(`/inbox/support-requests/${requestId}/cancel`);

    if (response.status === 200) {
      log.success('Support request başarıyla iptal edildi!');
      
      if (socket) {
        socket.emit('cancel_support_request', { requestId });
      }
      
      return true;
    }
    
    return false;
  } catch (error: any) {
    log.error(`Support request cancel hatası: ${error.response?.data?.message || error.message}`);
    return false;
  }
}

/**
 * Senaryo 17: Support Thread'de Mesaj Gönder
 */
async function sendSupportMessage(api: AxiosInstance, socket: Socket | null): Promise<boolean> {
  try {
    let threadId = state.currentSupportThreadId;
    
    if (!threadId) {
      threadId = await question('Support Thread ID girin: ');
      if (!threadId) {
        log.error('Support Thread ID gerekli!');
        return false;
      }
    }

    const message = await question('Support mesajı: ');
    if (!message.trim()) {
      log.error('Mesaj boş olamaz!');
      return false;
    }

    log.info(`Support thread'de mesaj gönderiliyor: ${threadId}...`);

    // Socket ile gönder (önerilen yöntem)
    if (socket) {
      socket.emit('send_support_message', {
        threadId,
        message: message.trim(),
      });
      log.success('Support mesajı socket ile gönderildi!');
      return true;
    } else {
      // REST API ile (alternatif - thread media endpoint'i görsel için, text için değil)
      // Support thread'de text mesaj için direkt POST /inbox kullanılabilir ama threadId ile değil
      // Bu durumda socket kullanmak daha mantıklı
      log.error('Socket bağlantısı yok! Support mesajı göndermek için socket gerekli.');
      return false;
    }
  } catch (error: any) {
    log.error(`Support mesaj gönderme hatası: ${error.response?.data?.message || error.message}`);
    return false;
  }
}

/**
 * Senaryo 18: Support Request Close
 */
async function closeSupportRequest(api: AxiosInstance): Promise<boolean> {
  try {
    let requestId = state.lastSupportRequestId;
    
    if (!requestId) {
      requestId = await question('Support Request ID girin: ');
      if (!requestId) {
        log.error('Request ID gerekli!');
        return false;
      }
    }

    const ratingStr = await question('Rating (1-5): ');
    const rating = parseInt(ratingStr);
    if (isNaN(rating) || rating < 1 || rating > 5) {
      log.error('Geçersiz rating! (1-5 arası olmalı)');
      return false;
    }

    const comment = await question('Yorum (opsiyonel, Enter ile geç): ');

    log.info(`Support request kapatılıyor: ${requestId}...`);

    const response = await api.post(`/inbox/support-requests/${requestId}/close`, {
      rating,
      comment: comment.trim() || undefined,
    });

    if (response.status === 200) {
      log.success('Support request başarıyla kapatıldı!');
      log.info(`Status: ${response.data.status || 'N/A'}`);
      return true;
    }
    
    return false;
  } catch (error: any) {
    log.error(`Support request close hatası: ${error.response?.data?.message || error.message}`);
    return false;
  }
}

/**
 * Senaryo 19: Support Request Report
 */
async function reportSupportRequest(api: AxiosInstance): Promise<boolean> {
  try {
    let requestId = state.lastSupportRequestId;
    
    if (!requestId) {
      requestId = await question('Support Request ID girin: ');
      if (!requestId) {
        log.error('Request ID gerekli!');
        return false;
      }
    }

    console.log('\nRapor Sebebi:');
    console.log('  1. SPAM');
    console.log('  2. INAPPROPRIATE');
    console.log('  3. SCAM');
    console.log('  4. OTHER');
    
    const reasonChoice = await question('Sebep seçin (1-4): ');
    let reason = 'OTHER';
    switch (reasonChoice) {
      case '1': reason = 'SPAM'; break;
      case '2': reason = 'INAPPROPRIATE'; break;
      case '3': reason = 'SCAM'; break;
      case '4': reason = 'OTHER'; break;
      default:
        log.error('Geçersiz seçim!');
        return false;
    }

    const description = await question('Açıklama (opsiyonel, Enter ile geç): ');

    log.info(`Support request raporlanıyor: ${requestId}...`);

    const response = await api.post(`/inbox/support-requests/${requestId}/report`, {
      reason,
      description: description.trim() || undefined,
    });

    if (response.status === 200) {
      log.success('Support request başarıyla raporlandı!');
      return true;
    }
    
    return false;
  } catch (error: any) {
    log.error(`Support request report hatası: ${error.response?.data?.message || error.message}`);
    return false;
  }
}

/**
 * Senaryo 20: TIPS Gönder
 */
async function sendTips(api: AxiosInstance, senderId: string, recipientId: string): Promise<boolean> {
  try {
    const amountStr = await question('TIPS miktarı: ');
    const amount = parseFloat(amountStr);
    if (isNaN(amount) || amount <= 0) {
      log.error('Geçersiz miktar!');
      return false;
    }

    const message = await question('Mesaj (opsiyonel, Enter ile geç): ');

    log.info('TIPS gönderiliyor...');

    const response = await api.post('/inbox/tips', {
      senderUserId: senderId,
      recipientUserId: recipientId,
      amount,
      message: message.trim() || undefined,
      timestamp: new Date().toISOString(),
    });

    if (response.status === 201) {
      log.success('TIPS başarıyla gönderildi!');
      log.info(`Transaction ID: ${response.data.transactionId || 'N/A'}`);
      return true;
    }
    
    return false;
  } catch (error: any) {
    log.error(`TIPS gönderme hatası: ${error.response?.data?.message || error.message}`);
    return false;
  }
}

/**
 * Senaryo 21: Socket Join Thread
 */
async function socketJoinThread(socket: Socket | null): Promise<boolean> {
  try {
    if (!socket) {
      log.error('Socket bağlantısı yok!');
      return false;
    }

    let threadId = state.currentThreadId;
    
    if (!threadId) {
      threadId = await question('Thread ID girin: ');
      if (!threadId) {
        log.error('Thread ID gerekli!');
        return false;
      }
    }

    log.info(`Thread'e katılıyor: ${threadId}...`);
    socket.emit('join_thread', { threadId });
    log.success('Join thread event gönderildi!');
    return true;
  } catch (error: any) {
    log.error(`Join thread hatası: ${error.message}`);
    return false;
  }
}

/**
 * Senaryo 22: Socket Leave Thread
 */
async function socketLeaveThread(socket: Socket | null): Promise<boolean> {
  try {
    if (!socket) {
      log.error('Socket bağlantısı yok!');
      return false;
    }

    let threadId = state.currentThreadId;
    
    if (!threadId) {
      threadId = await question('Thread ID girin: ');
      if (!threadId) {
        log.error('Thread ID gerekli!');
        return false;
      }
    }

    log.info(`Thread'den ayrılıyor: ${threadId}...`);
    socket.emit('leave_thread', { threadId });
    log.success('Leave thread event gönderildi!');
    return true;
  } catch (error: any) {
    log.error(`Leave thread hatası: ${error.message}`);
    return false;
  }
}

/**
 * Senaryo 23: Socket Mark Message Read
 */
async function socketMarkMessageRead(socket: Socket | null): Promise<boolean> {
  try {
    if (!socket) {
      log.error('Socket bağlantısı yok!');
      return false;
    }

    if (state.lastMessageIds.length === 0) {
      log.error('Mesaj bulunamadı. Önce mesaj gönderin.');
      return false;
    }

    const messageId = state.lastMessageIds[0];
    log.info(`Mesaj okundu işaretleniyor: ${messageId}...`);
    socket.emit('mark_message_read', { messageId });
    log.success('Mark message read event gönderildi!');
    return true;
  } catch (error: any) {
    log.error(`Mark message read hatası: ${error.message}`);
    return false;
  }
}

/**
 * Senaryo 24: Socket Mark Thread Read
 */
async function socketMarkThreadRead(socket: Socket | null): Promise<boolean> {
  try {
    if (!socket) {
      log.error('Socket bağlantısı yok!');
      return false;
    }

    let threadId = state.currentThreadId;
    
    if (!threadId) {
      threadId = await question('Thread ID girin: ');
      if (!threadId) {
        log.error('Thread ID gerekli!');
        return false;
      }
    }

    log.info(`Thread okundu işaretleniyor: ${threadId}...`);
    socket.emit('mark_thread_read', { threadId });
    log.success('Mark thread read event gönderildi!');
    return true;
  } catch (error: any) {
    log.error(`Mark thread read hatası: ${error.message}`);
    return false;
  }
}

/**
 * Ana menü göster
 */
function showMainMenu(userName: string): void {
  console.log('\n' + '═'.repeat(60));
  console.log(`  Mesajlaşma Test Script'i - ${userName.toUpperCase()}`);
  console.log('═'.repeat(60));
  console.log('  A. Temel Mesajlaşma');
  console.log('    1.  Text Mesaj Gönder');
  console.log('    2.  Görsel Mesaj Gönder');
  console.log('    3.  Mesaj Sil');
  console.log('    4.  Mesaj Düzenle');
  console.log('');
  console.log('  B. Reactions');
  console.log('    5.  Reaction Ekle');
  console.log('    6.  Reaction Sil');
  console.log('    7.  Reactions Listele');
  console.log('');
  console.log('  C. Typing Indicators');
  console.log('    8.  Typing Start');
  console.log('    9.  Typing Stop');
  console.log('');
  console.log('  D. Thread İşlemleri');
  console.log('    10. Thread Mesajlarını Getir');
  console.log('    11. Thread Sil');
  console.log('    12. Thread Ara');
  console.log('');
  console.log('  E. Support Request İşlemleri');
  console.log('    13. Support Request Oluştur');
  console.log('    14. Support Request Accept');
  console.log('    15. Support Request Reject');
  console.log('    16. Support Request Cancel');
  console.log('    17. Support Thread\'de Mesaj Gönder');
  console.log('    18. Support Request Close');
  console.log('    19. Support Request Report');
  console.log('');
  console.log('  F. TIPS İşlemleri');
  console.log('    20. TIPS Gönder');
  console.log('');
  console.log('  G. Socket Event Testleri');
  console.log('    21. Socket: Join Thread');
  console.log('    22. Socket: Leave Thread');
  console.log('    23. Socket: Mark Message Read');
  console.log('    24. Socket: Mark Thread Read');
  console.log('');
  console.log('  0.  Kullanıcı Değiştir');
  console.log('  q.  Çıkış');
  console.log('═'.repeat(60));
}

/**
 * Ana döngü
 */
async function main() {
  try {
    log.title('╔═══════════════════════════════════════════════════════╗');
    log.title('║   Interaktif Mesajlaşma Test Script\'i                 ║');
    log.title('╚═══════════════════════════════════════════════════════╝');
    console.log('');

    // İlk kullanıcı seçimi
    console.log('Kullanıcı seçin:');
    console.log('  1. Tuna');
    console.log('  2. Omer');
    
    let userChoice = await question('Seçim (1-2): ');
    let currentUserId = userChoice === '1' ? TUNA_USER_ID : OMER_USER_ID;
    let currentUserEmail = userChoice === '1' ? TUNA_EMAIL : OMER_EMAIL;
    let currentUserName = userChoice === '1' ? 'Tuna' : 'Omer';
    let otherUserId = userChoice === '1' ? OMER_USER_ID : TUNA_USER_ID;
    let otherUserName = userChoice === '1' ? 'Omer' : 'Tuna';

    // Login
    const token = await login(currentUserId, currentUserEmail);
    if (!token) {
      log.error('Giriş başarısız! Script sonlandırılıyor.');
      process.exit(1);
    }

    // Socket bağlantısı
    const socket = await connectSocket(token, currentUserName);
    if (!socket) {
      log.warning('Socket bağlantısı kurulamadı, devam ediliyor...');
    }

    // API client
    const api = createApiClient(token);

    // State güncelle
    if (currentUserName === 'Tuna') {
      state.tunaToken = token;
      state.tunaSocket = socket || undefined;
    } else {
      state.omerToken = token;
      state.omerSocket = socket || undefined;
    }
    state.currentUser = currentUserName.toLowerCase() as 'tuna' | 'omer';

    // Ana döngü
    while (true) {
      showMainMenu(currentUserName);
      const choice = await question('\nSeçim yapın: ');

      if (choice === 'q' || choice === '0') {
        if (choice === '0') {
          // Kullanıcı değiştir
          console.log('\nKullanıcı seçin:');
          console.log('  1. Tuna');
          console.log('  2. Omer');
          
          userChoice = await question('Seçim (1-2): ');
          currentUserId = userChoice === '1' ? TUNA_USER_ID : OMER_USER_ID;
          currentUserEmail = userChoice === '1' ? TUNA_EMAIL : OMER_EMAIL;
          currentUserName = userChoice === '1' ? 'Tuna' : 'Omer';
          otherUserId = userChoice === '1' ? OMER_USER_ID : TUNA_USER_ID;
          otherUserName = userChoice === '1' ? 'Omer' : 'Tuna';

          // Yeni kullanıcı için login
          const newToken = await login(currentUserId, currentUserEmail);
          if (!newToken) {
            log.error('Giriş başarısız!');
            continue;
          }

          // Yeni socket
          const newSocket = await connectSocket(newToken, currentUserName);
          
          // API client güncelle
          api.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;
          
          // State güncelle
          if (currentUserName === 'Tuna') {
            state.tunaToken = newToken;
            state.tunaSocket = newSocket || undefined;
          } else {
            state.omerToken = newToken;
            state.omerSocket = newSocket || undefined;
          }
          state.currentUser = currentUserName.toLowerCase() as 'tuna' | 'omer';
          
          continue;
        } else {
          // Çıkış
          log.info('Script sonlandırılıyor...');
          break;
        }
      }

      let result: boolean | string | null = false;
      const currentSocket = currentUserName === 'Tuna' ? state.tunaSocket : state.omerSocket;

      switch (choice) {
        case '1':
          result = await sendTextMessage(api, otherUserId);
          if (result) {
            state.lastMessageIds.unshift(result as string);
          }
          break;
        case '2':
          result = await sendImageMessage(api, otherUserId);
          if (result) {
            state.lastMessageIds.unshift(result as string);
          }
          break;
        case '3':
          result = await deleteMessage(api);
          break;
        case '4':
          result = await editMessage(api);
          break;
        case '5':
          result = await addReaction(api);
          break;
        case '6':
          result = await removeReaction(api);
          break;
        case '7':
          result = await listReactions(api);
          break;
        case '8':
          result = await typingStart(currentSocket || null);
          break;
        case '9':
          result = await typingStop(currentSocket || null);
          break;
        case '10':
          result = await getThreadMessages(api);
          break;
        case '11':
          result = await deleteThread(api);
          break;
        case '12':
          result = await searchThread(api);
          break;
        case '13':
          result = await createSupportRequest(api, currentUserId, otherUserId);
          break;
        case '14':
          result = await acceptSupportRequest(api, currentSocket || null);
          break;
        case '15':
          result = await rejectSupportRequest(api, currentSocket || null);
          break;
        case '16':
          result = await cancelSupportRequest(api, currentSocket || null);
          break;
        case '17':
          result = await sendSupportMessage(api, currentSocket || null);
          break;
        case '18':
          result = await closeSupportRequest(api);
          break;
        case '19':
          result = await reportSupportRequest(api);
          break;
        case '20':
          result = await sendTips(api, currentUserId, otherUserId);
          break;
        case '21':
          result = await socketJoinThread(currentSocket || null);
          break;
        case '22':
          result = await socketLeaveThread(currentSocket || null);
          break;
        case '23':
          result = await socketMarkMessageRead(currentSocket || null);
          break;
        case '24':
          result = await socketMarkThreadRead(currentSocket || null);
          break;
        default:
          log.error('Geçersiz seçim!');
          break;
      }

      if (result) {
        await question('\nDevam etmek için Enter\'a basın...');
      }
    }

    // Cleanup
    if (state.tunaSocket) {
      state.tunaSocket.disconnect();
    }
    if (state.omerSocket) {
      state.omerSocket.disconnect();
    }
    rl.close();
  } catch (error: any) {
    log.error(`Fatal error: ${error.message}`);
    if (error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

// Script çalıştır
main();
