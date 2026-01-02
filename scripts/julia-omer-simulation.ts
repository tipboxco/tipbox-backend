/**
 * Julia-Omer Mesajlaşma Simülasyonu
 * 
 * Bu script, Julia ve Omer arasında terminal üzerinden interaktif mesajlaşma simülasyonu yapar.
 * Socket.IO, REST API, Notification, Request ve Tips işlemlerini test eder.
 * 
 * ⚠️  ÖNEMLİ: Bu script TÜM işlemleri VERİTABANINA KALICI olarak yazar:
 * - Mesajlar → dm_messages tablosuna yazılır
 * - Thread'ler → dm_threads tablosuna yazılır
 * - Support Request'ler → dm_requests tablosuna yazılır
 * - Tips transferleri → tips_token_transfers tablosuna yazılır
 * - Notification'lar → notifications tablosuna yazılır
 * 
 * Tüm işlemler gerçek API endpoint'leri ve servisler üzerinden yapılır.
 * Geçici veya test verisi oluşturulmaz - her şey production veritabanına yazılır.
 */

import { io, Socket } from 'socket.io-client';
import axios, { AxiosInstance } from 'axios';
import * as readline from 'readline';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

// Constants
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const JULIA_USER_ID = '99999999-9999-4999-9999-999999999999';
const OMER_USER_ID = '480f5de9-b691-4d70-a6a8-2789226f4e07';

// User credentials (seed'den)
const JULIA_EMAIL = 'julia.havk@tipbox.co';
const OMER_EMAIL = 'omer@tipbox.co';
const DEFAULT_PASSWORD = 'password123';

// Types
interface Thread {
  id: string;
  userOneId: string;
  userTwoId: string;
  isActive: boolean;
  startedAt: string;
  isSupportThread?: boolean;
}

interface SupportRequest {
  id: string;
  senderUserId: string;
  recipientUserId: string;
  type: string;
  message: string;
  amount: string;
  status: string;
  threadId?: string | null;
  createdAt: string;
}

interface Message {
  id: string;
  threadId: string;
  senderId: string;
  message: string;
  isRead: boolean;
  createdAt: string;
}

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  data?: any;
  read: boolean;
  createdAt: string;
}

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

class SimulationClient {
  private socket: Socket | null = null;
  private api: AxiosInstance;
  private token: string = '';
  private userId: string = '';
  private userName: string = '';
  private currentThreadId: string | null = null;
  private supportRequests: SupportRequest[] = [];
  private rl: readline.Interface;

  constructor(userId: string, userEmail: string, userName: string) {
    this.userId = userId;
    this.userName = userName;
    this.api = axios.create({
      baseURL: BASE_URL,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
  }

  /**
   * Login ve token al
   */
  async login(): Promise<boolean> {
    try {
      console.log(`${colors.cyan}🔐 ${this.userName} olarak giriş yapılıyor...${colors.reset}`);
      
      const email = this.userId === JULIA_USER_ID ? JULIA_EMAIL : OMER_EMAIL;
      const response = await this.api.post('/auth/login', {
        email,
        password: DEFAULT_PASSWORD,
      });

      // Response formatı: { id, fullName, email, avatar, token, refreshToken }
      if (response.data && response.data.token) {
        this.token = response.data.token;
        this.api.defaults.headers.common['Authorization'] = `Bearer ${this.token}`;
        console.log(`${colors.green}✅ Giriş başarılı!${colors.reset}`);
        console.log(`   Kullanıcı: ${response.data.email || email}`);
        console.log(`   İsim: ${response.data.fullName || 'N/A'}\n`);
        return true;
      }

      console.error(`${colors.red}❌ Token response formatı beklenmedik:${colors.reset}`, response.data);
      return false;
    } catch (error: any) {
      console.error(`${colors.red}❌ Giriş hatası:${colors.reset}`, error.response?.data || error.message);
      return false;
    }
  }

  /**
   * Socket.IO bağlantısı kur
   */
  async connectSocket(): Promise<void> {
    return new Promise((resolve, reject) => {
      console.log(`${colors.cyan}🔌 Socket.IO bağlantısı kuruluyor...${colors.reset}`);

      this.socket = io(BASE_URL, {
        auth: {
          token: this.token,
        },
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionAttempts: 5,
      });

      this.socket.on('connect', () => {
        console.log(`${colors.green}✅ Socket.IO bağlantısı kuruldu!${colors.reset}\n`);
        this.setupSocketHandlers();
        resolve();
      });

      this.socket.on('connect_error', (error) => {
        console.error(`${colors.red}❌ Socket bağlantı hatası:${colors.reset}`, error.message);
        reject(error);
      });

      this.socket.on('disconnect', (reason) => {
        console.log(`${colors.yellow}⚠️  Socket bağlantısı kesildi:${colors.reset}`, reason);
      });
    });
  }

  /**
   * Socket event handler'larını kur
   */
  private setupSocketHandlers(): void {
    if (!this.socket) return;

    // Yeni mesaj geldiğinde
    this.socket.on('new_message', (data: any) => {
      console.log(`\n${colors.magenta}📨 YENİ MESAJ GELDİ:${colors.reset}`);
      console.log(`   Thread ID: ${data.threadId || 'N/A'}`);
      console.log(`   Gönderen: ${data.senderId || 'N/A'}`);
      console.log(`   Mesaj: ${data.message || 'N/A'}`);
      console.log(`   Tip: ${data.messageType || 'DM'}`);
      if (data.amount) {
        console.log(`   💰 TIPS: ${data.amount} TIPS`);
      }
      console.log('');
      this.showMenu();
    });

    // Mesaj okundu
    this.socket.on('message_read', (data: any) => {
      console.log(`\n${colors.blue}✓ Mesaj okundu:${colors.reset} ${data.messageId}\n`);
    });

    // Typing indicator (user_typing event)
    this.socket.on('user_typing', (data: any) => {
      if (data.userId !== this.userId) {
        if (data.isTyping) {
          console.log(`\n${colors.yellow}⌨️  Kullanıcı yazıyor...${colors.reset}\n`);
        } else {
          console.log(`\n${colors.yellow}⌨️  Kullanıcı yazmayı bıraktı${colors.reset}\n`);
        }
      }
    });

    // Notification
    this.socket.on('notification', (data: any) => {
      console.log(`\n${colors.cyan}🔔 BİLDİRİM:${colors.reset}`);
      console.log(`   Başlık: ${data.title || 'N/A'}`);
      console.log(`   Mesaj: ${data.message || 'N/A'}`);
      if (data.data) {
        console.log(`   Veri:`, JSON.stringify(data.data, null, 2));
      }
      console.log('');
      this.showMenu();
    });

    // Error
    this.socket.on('error', (data: any) => {
      console.error(`${colors.red}❌ Socket Hatası:${colors.reset}`, data.message || data);
    });

    // Request events
    this.socket.on('support_request_created', (data: any) => {
      console.log(`\n${colors.green}📋 Support Request oluşturuldu:${colors.reset}`);
      console.log(`   Request ID: ${data.requestId}`);
      console.log(`   Durum: ${data.status}\n`);
    });

    this.socket.on('support_request_accepted', (data: any) => {
      console.log(`\n${colors.green}✅ Support Request kabul edildi:${colors.reset}`);
      console.log(`   Request ID: ${data.requestId}`);
      console.log(`   Thread ID: ${data.threadId}\n`);
    });

    this.socket.on('support_request_rejected', (data: any) => {
      console.log(`\n${colors.red}❌ Support Request reddedildi:${colors.reset}`);
      console.log(`   Request ID: ${data.requestId}\n`);
    });

    this.socket.on('support_request_cancelled', (data: any) => {
      console.log(`\n${colors.yellow}⚠️  Support Request iptal edildi:${colors.reset}`);
      console.log(`   Request ID: ${data.requestId}\n`);
    });
  }

  /**
   * Thread oluştur veya mevcut thread'i getir
   */
  async getOrCreateThread(recipientId: string): Promise<Thread | null> {
    try {
      const response = await this.api.post('/messages/threads', {
        recipientId,
      });

      if (response.data.id) {
        this.currentThreadId = response.data.id;
        return response.data;
      }
      return null;
    } catch (error: any) {
      console.error(`${colors.red}❌ Thread hatası:${colors.reset}`, error.response?.data || error.message);
      return null;
    }
  }

  /**
   * REST API ile mesaj gönder (typing indicator ile)
   */
  async sendMessageViaAPI(recipientId: string, message: string): Promise<boolean> {
    try {
      // Önce thread'i al veya oluştur
      let threadId = this.currentThreadId;
      if (!threadId) {
        const thread = await this.getOrCreateThread(recipientId);
        if (!thread) {
          console.error(`${colors.red}❌ Thread oluşturulamadı!${colors.reset}`);
          return false;
        }
        threadId = thread.id;
        this.currentThreadId = threadId;
      }

      // Socket varsa typing indicator'ları tetikle
      if (this.socket && this.socket.connected && threadId) {
        await this.joinThread(threadId);
        await this.startTypingIndicator(threadId);
        
        // Kısa bir süre bekle
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      // Mesajı gönder (VERİTABANINA KALICI YAZILIR)
      const response = await this.api.post('/messages', {
        recipientUserId: recipientId,
        message,
      });

      // Typing indicator'ı durdur
      if (this.socket && this.socket.connected && threadId) {
        await this.stopTypingIndicator(threadId);
      }

      console.log(`${colors.green}✅ Mesaj gönderildi (REST API)${colors.reset}`);
      console.log(`${colors.cyan}   📝 Veritabanına kalıcı olarak yazıldı (dm_messages)${colors.reset}\n`);
      return true;
    } catch (error: any) {
      console.error(`${colors.red}❌ Mesaj gönderme hatası:${colors.reset}`, error.response?.data || error.message);
      return false;
    }
  }

  /**
   * Socket.IO ile mesaj gönder (typing indicator ile)
   */
  async sendMessageViaSocket(recipientId: string, message: string): Promise<boolean> {
    if (!this.socket || !this.socket.connected) {
      console.error(`${colors.red}❌ Socket bağlantısı yok!${colors.reset}`);
      return false;
    }

    // Önce thread'i al veya oluştur
    let threadId = this.currentThreadId;
    if (!threadId) {
      const thread = await this.getOrCreateThread(recipientId);
      if (!thread) {
        console.error(`${colors.red}❌ Thread oluşturulamadı!${colors.reset}`);
        return false;
      }
      threadId = thread.id;
      this.currentThreadId = threadId;
    }

    // Thread'e join ol (eğer değilse)
    await this.joinThread(threadId);

    return new Promise((resolve) => {
      // Typing indicator başlat
      this.startTypingIndicator(threadId!);
      
      // Kısa bir süre bekle (gerçekçi typing simülasyonu)
      setTimeout(() => {
        // Mesajı gönder
        this.socket!.emit('send_message', {
          recipientId,
          message,
        });

        // Typing indicator'ı durdur
        setTimeout(() => {
          this.stopTypingIndicator(threadId!);
          console.log(`${colors.green}✅ Mesaj gönderildi (Socket.IO)${colors.reset}`);
          console.log(`${colors.cyan}   📝 Veritabanına kalıcı olarak yazıldı (dm_messages)${colors.reset}\n`);
          resolve(true);
        }, 200);
      }, 500);
    });
  }

  /**
   * Support Request oluştur
   */
  async createSupportRequest(
    recipientId: string,
    type: 'GENERAL' | 'TECHNICAL' | 'PRODUCT',
    message: string,
    amount: number
  ): Promise<SupportRequest | null> {
    try {
      const response = await this.api.post('/messages/support-requests', {
        senderUserId: this.userId,
        recipientUserId: recipientId,
        type,
        message,
        amount: amount.toString(),
        status: 'pending',
        timestamp: new Date().toISOString(),
      });

      if (response.status === 201) {
        // Request ID'yi response'dan al (eğer varsa)
        console.log(`${colors.green}✅ Support Request oluşturuldu${colors.reset}`);
        console.log(`${colors.cyan}   📝 Veritabanına kalıcı olarak yazıldı (dm_requests)${colors.reset}\n`);
        // Request'i listeye eklemek için getSupportRequests çağrılabilir
        await this.refreshSupportRequests();
        return null; // Response body'de request dönmüyor gibi görünüyor
      }
      return null;
    } catch (error: any) {
      console.error(`${colors.red}❌ Support Request hatası:${colors.reset}`, error.response?.data || error.message);
      return null;
    }
  }

  /**
   * Support Request'leri getir
   */
  async refreshSupportRequests(): Promise<void> {
    try {
      const response = await this.api.get('/messages/support-requests');
      if (response.data && Array.isArray(response.data)) {
        this.supportRequests = response.data;
      }
    } catch (error: any) {
      console.error(`${colors.red}❌ Support Request listesi hatası:${colors.reset}`, error.response?.data || error.message);
    }
  }

  /**
   * Support Request kabul et
   */
  async acceptSupportRequest(requestId: string): Promise<boolean> {
    try {
      const response = await this.api.post(`/messages/support-requests/${requestId}/accept`);
      if (response.data.threadId) {
        this.currentThreadId = response.data.threadId;
        console.log(`${colors.green}✅ Support Request kabul edildi${colors.reset}`);
        console.log(`   Thread ID: ${response.data.threadId}`);
        console.log(`${colors.cyan}   📝 Veritabanına kalıcı olarak yazıldı (dm_requests, dm_threads)${colors.reset}\n`);
        await this.refreshSupportRequests();
        return true;
      }
      return false;
    } catch (error: any) {
      console.error(`${colors.red}❌ Request kabul hatası:${colors.reset}`, error.response?.data || error.message);
      return false;
    }
  }

  /**
   * Support Request reddet
   */
  async rejectSupportRequest(requestId: string): Promise<boolean> {
    try {
      await this.api.post(`/messages/support-requests/${requestId}/reject`);
      console.log(`${colors.green}✅ Support Request reddedildi${colors.reset}\n`);
      await this.refreshSupportRequests();
      return true;
    } catch (error: any) {
      console.error(`${colors.red}❌ Request reddetme hatası:${colors.reset}`, error.response?.data || error.message);
      return false;
    }
  }

  /**
   * Support Request iptal et
   */
  async cancelSupportRequest(requestId: string): Promise<boolean> {
    try {
      await this.api.post(`/messages/support-requests/${requestId}/cancel`);
      console.log(`${colors.green}✅ Support Request iptal edildi${colors.reset}\n`);
      await this.refreshSupportRequests();
      return true;
    } catch (error: any) {
      console.error(`${colors.red}❌ Request iptal hatası:${colors.reset}`, error.response?.data || error.message);
      return false;
    }
  }

  /**
   * Tips gönder
   */
  async sendTips(recipientId: string, message: string, amount: number): Promise<boolean> {
    try {
      await this.api.post('/messages/tips', {
        senderUserId: this.userId,
        recipientUserId: recipientId,
        message,
        amount,
        timestamp: new Date().toISOString(),
      });
      console.log(`${colors.green}✅ ${amount} TIPS gönderildi!${colors.reset}`);
      console.log(`${colors.cyan}   📝 Veritabanına kalıcı olarak yazıldı (tips_token_transfers, dm_messages)${colors.reset}\n`);
      return true;
    } catch (error: any) {
      console.error(`${colors.red}❌ Tips gönderme hatası:${colors.reset}`, error.response?.data || error.message);
      return false;
    }
  }

  /**
   * Thread mesajlarını getir
   */
  async getThreadMessages(threadId: string): Promise<Message[]> {
    try {
      const response = await this.api.get(`/messages/${threadId}`);
      if (response.data && response.data.messages) {
        return response.data.messages;
      }
      return [];
    } catch (error: any) {
      console.error(`${colors.red}❌ Mesaj listesi hatası:${colors.reset}`, error.response?.data || error.message);
      return [];
    }
  }

  /**
   * Inbox feed'i getir
   */
  async getInboxFeed(): Promise<any> {
    try {
      const response = await this.api.get('/messages/feed');
      return response.data || [];
    } catch (error: any) {
      console.error(`${colors.red}❌ Inbox feed hatası:${colors.reset}`, error.response?.data || error.message);
      return [];
    }
  }

  /**
   * Inbox listesini getir
   */
  async getInboxList(): Promise<any[]> {
    try {
      const response = await this.api.get('/messages');
      return response.data || [];
    } catch (error: any) {
      console.error(`${colors.red}❌ Inbox listesi hatası:${colors.reset}`, error.response?.data || error.message);
      return [];
    }
  }

  /**
   * Typing indicator başlat
   */
  async startTypingIndicator(threadId: string): Promise<void> {
    if (!this.socket || !this.socket.connected) return;

    this.socket.emit('typing_start', {
      threadId,
    });
  }

  /**
   * Typing indicator durdur
   */
  async stopTypingIndicator(threadId: string): Promise<void> {
    if (!this.socket || !this.socket.connected) return;

    this.socket.emit('typing_stop', {
      threadId,
    });
  }

  /**
   * Thread'e join ol
   */
  async joinThread(threadId: string): Promise<void> {
    if (!this.socket || !this.socket.connected) return;

    this.socket.emit('join_thread', {
      threadId,
    });
  }

  /**
   * Thread'den ayrıl
   */
  async leaveThread(threadId: string): Promise<void> {
    if (!this.socket || !this.socket.connected) return;

    this.socket.emit('leave_thread', {
      threadId,
    });
  }

  /**
   * Notification'ları getir
   */
  async getNotifications(): Promise<Notification[]> {
    try {
      const response = await this.api.get('/notifications');
      if (response.data && response.data.data) {
        return response.data.data;
      }
      return [];
    } catch (error: any) {
      console.error(`${colors.red}❌ Notification hatası:${colors.reset}`, error.response?.data || error.message);
      return [];
    }
  }

  /**
   * Ana menüyü göster
   */
  showMenu(): void {
    console.log(`${colors.bright}${colors.cyan}════════════════════════════════════════${colors.reset}`);
    console.log(`${colors.bright}${colors.cyan}  ${this.userName} - Ana Menü${colors.reset}`);
    console.log(`${colors.bright}${colors.cyan}════════════════════════════════════════${colors.reset}`);
    console.log(`${colors.yellow}1.${colors.reset} Mesaj gönder (REST API)`);
    console.log(`${colors.yellow}2.${colors.reset} Mesaj gönder (Socket.IO)`);
    console.log(`${colors.yellow}3.${colors.reset} Support Request oluştur`);
    console.log(`${colors.yellow}4.${colors.reset} Gelen Request'leri listele`);
    console.log(`${colors.yellow}5.${colors.reset} Request kabul et`);
    console.log(`${colors.yellow}6.${colors.reset} Request reddet`);
    console.log(`${colors.yellow}7.${colors.reset} Request iptal et`);
    console.log(`${colors.yellow}8.${colors.reset} Tips gönder`);
    console.log(`${colors.yellow}9.${colors.reset} Thread mesajlarını getir`);
    console.log(`${colors.yellow}10.${colors.reset} Inbox listesini getir`);
    console.log(`${colors.yellow}11.${colors.reset} Inbox feed'i getir`);
    console.log(`${colors.yellow}12.${colors.reset} Notification'ları getir`);
    console.log(`${colors.yellow}13.${colors.reset} Thread'e join ol`);
    console.log(`${colors.yellow}14.${colors.reset} Thread'den ayrıl`);
    console.log(`${colors.yellow}15.${colors.reset} Typing indicator gönder`);
    console.log(`${colors.yellow}16.${colors.reset} Typing indicator durdur`);
    console.log(`${colors.yellow}17.${colors.reset} Thread oluştur/getir`);
    console.log(`${colors.yellow}0.${colors.reset} Çıkış`);
    console.log(`${colors.bright}${colors.cyan}════════════════════════════════════════${colors.reset}\n`);
  }

  /**
   * Kullanıcı input'unu bekle ve işle
   */
  async waitForInput(): Promise<void> {
    return new Promise((resolve) => {
      this.rl.question(`${colors.green}Seçiminiz: ${colors.reset}`, async (answer) => {
        await this.handleMenuChoice(answer.trim());
        resolve();
      });
    });
  }

  /**
   * Menü seçimini işle
   */
  async handleMenuChoice(choice: string): Promise<void> {
    const otherUserId = this.userId === JULIA_USER_ID ? OMER_USER_ID : JULIA_USER_ID;
    const otherUserName = this.userId === JULIA_USER_ID ? 'Omer' : 'Julia';

    switch (choice) {
      case '1': {
        // REST API ile mesaj gönder
        const message = await this.promptInput('Mesaj: ');
        if (message) {
          await this.sendMessageViaAPI(otherUserId, message);
        }
        break;
      }

      case '2': {
        // Socket.IO ile mesaj gönder
        const message = await this.promptInput('Mesaj: ');
        if (message) {
          await this.sendMessageViaSocket(otherUserId, message);
        }
        break;
      }

      case '3': {
        // Support Request oluştur
        console.log('\nSupport Request Tipi:');
        console.log('1. GENERAL');
        console.log('2. TECHNICAL');
        console.log('3. PRODUCT');
        const typeChoice = await this.promptInput('Tip seçin (1-3): ');
        const types: ('GENERAL' | 'TECHNICAL' | 'PRODUCT')[] = ['GENERAL', 'TECHNICAL', 'PRODUCT'];
        const type = types[parseInt(typeChoice) - 1] || 'GENERAL';

        const message = await this.promptInput('Mesaj: ');
        const amountStr = await this.promptInput('TIPS miktarı: ');
        const amount = parseFloat(amountStr) || 0;

        if (message && amount > 0) {
          await this.createSupportRequest(otherUserId, type, message, amount);
        }
        break;
      }

      case '4': {
        // Gelen Request'leri listele
        await this.refreshSupportRequests();
        console.log(`\n${colors.cyan}📋 Support Request'ler:${colors.reset}`);
        if (this.supportRequests.length === 0) {
          console.log('   Henüz request yok.\n');
        } else {
          this.supportRequests.forEach((req, index) => {
            console.log(`\n   ${index + 1}. Request ID: ${req.id}`);
            console.log(`      Durum: ${req.status}`);
            console.log(`      Tip: ${req.type}`);
            console.log(`      Mesaj: ${req.message}`);
            console.log(`      Miktar: ${req.amount} TIPS`);
            if (req.threadId) {
              console.log(`      Thread ID: ${req.threadId}`);
            }
          });
          console.log('');
        }
        break;
      }

      case '5': {
        // Request kabul et
        await this.refreshSupportRequests();
        const pendingRequests = this.supportRequests.filter(
          (r) => r.status === 'pending' && r.recipientUserId === this.userId
        );
        if (pendingRequests.length === 0) {
          console.log(`${colors.yellow}⚠️  Bekleyen request yok.${colors.reset}\n`);
        } else {
          console.log('\nBekleyen Request\'ler:');
          pendingRequests.forEach((req, index) => {
            console.log(`${index + 1}. ${req.id} - ${req.message.substring(0, 50)}...`);
          });
          const choice = await this.promptInput('Kabul edilecek request numarası: ');
          const index = parseInt(choice) - 1;
          if (index >= 0 && index < pendingRequests.length) {
            await this.acceptSupportRequest(pendingRequests[index].id);
          }
        }
        break;
      }

      case '6': {
        // Request reddet
        await this.refreshSupportRequests();
        const pendingRequests = this.supportRequests.filter(
          (r) => r.status === 'pending' && r.recipientUserId === this.userId
        );
        if (pendingRequests.length === 0) {
          console.log(`${colors.yellow}⚠️  Bekleyen request yok.${colors.reset}\n`);
        } else {
          console.log('\nBekleyen Request\'ler:');
          pendingRequests.forEach((req, index) => {
            console.log(`${index + 1}. ${req.id} - ${req.message.substring(0, 50)}...`);
          });
          const choice = await this.promptInput('Reddedilecek request numarası: ');
          const index = parseInt(choice) - 1;
          if (index >= 0 && index < pendingRequests.length) {
            await this.rejectSupportRequest(pendingRequests[index].id);
          }
        }
        break;
      }

      case '7': {
        // Request iptal et
        await this.refreshSupportRequests();
        const myRequests = this.supportRequests.filter(
          (r) => r.status === 'pending' && r.senderUserId === this.userId
        );
        if (myRequests.length === 0) {
          console.log(`${colors.yellow}⚠️  İptal edilecek request yok.${colors.reset}\n`);
        } else {
          console.log('\nİptal edilecek Request\'ler:');
          myRequests.forEach((req, index) => {
            console.log(`${index + 1}. ${req.id} - ${req.message.substring(0, 50)}...`);
          });
          const choice = await this.promptInput('İptal edilecek request numarası: ');
          const index = parseInt(choice) - 1;
          if (index >= 0 && index < myRequests.length) {
            await this.cancelSupportRequest(myRequests[index].id);
          }
        }
        break;
      }

      case '8': {
        // Tips gönder
        const message = await this.promptInput('Mesaj: ');
        const amountStr = await this.promptInput('TIPS miktarı: ');
        const amount = parseFloat(amountStr) || 0;

        if (message && amount > 0) {
          await this.sendTips(otherUserId, message, amount);
        }
        break;
      }

      case '9': {
        // Thread mesajlarını getir
        let threadId = this.currentThreadId;
        if (!threadId) {
          threadId = await this.promptInput('Thread ID: ');
        }
        if (threadId) {
          const messages = await this.getThreadMessages(threadId);
          console.log(`\n${colors.cyan}💬 Mesajlar (${messages.length} adet):${colors.reset}`);
          messages.forEach((msg) => {
            const isMe = msg.senderId === this.userId;
            console.log(`\n   ${isMe ? colors.green : colors.blue}[${isMe ? 'Siz' : 'Diğer'}]${colors.reset}`);
            console.log(`   ${msg.message}`);
            console.log(`   ${new Date(msg.createdAt).toLocaleString()}`);
            console.log(`   ${msg.isRead ? '✓ Okundu' : '○ Okunmadı'}`);
          });
          console.log('');
        }
        break;
      }

      case '10': {
        // Inbox listesini getir
        const inbox = await this.getInboxList();
        console.log(`\n${colors.cyan}📥 Inbox (${inbox.length} thread):${colors.reset}`);
        inbox.forEach((item: any, index: number) => {
          console.log(`\n   ${index + 1}. ${item.senderName || 'Bilinmeyen'}`);
          console.log(`      Son mesaj: ${item.lastMessage || 'Yok'}`);
          console.log(`      ${item.isUnread ? '🔴 Okunmamış' : '✓ Okundu'} (${item.unreadCount || 0})`);
          console.log(`      ${new Date(item.timestamp).toLocaleString()}`);
        });
        console.log('');
        break;
      }

      case '11': {
        // Inbox feed'i getir
        const feed = await this.getInboxFeed();
        console.log(`\n${colors.cyan}📰 Inbox Feed:${colors.reset}`);
        console.log(JSON.stringify(feed, null, 2));
        console.log('');
        break;
      }

      case '12': {
        // Notification'ları getir
        const notifications = await this.getNotifications();
        console.log(`\n${colors.cyan}🔔 Notification'lar (${notifications.length} adet):${colors.reset}`);
        notifications.slice(0, 10).forEach((notif) => {
          console.log(`\n   ${notif.read ? '✓' : '🔴'} ${notif.title}`);
          console.log(`      ${notif.message}`);
          console.log(`      ${new Date(notif.createdAt).toLocaleString()}`);
        });
        console.log('');
        break;
      }

      case '13': {
        // Thread'e join ol
        let threadId = this.currentThreadId;
        if (!threadId) {
          threadId = await this.promptInput('Thread ID: ');
        }
        if (threadId) {
          await this.joinThread(threadId);
          console.log(`${colors.green}✅ Thread'e join olundu${colors.reset}\n`);
        }
        break;
      }

      case '14': {
        // Thread'den ayrıl
        let threadId = this.currentThreadId;
        if (!threadId) {
          threadId = await this.promptInput('Thread ID: ');
        }
        if (threadId) {
          await this.leaveThread(threadId);
          console.log(`${colors.green}✅ Thread'den ayrıldınız${colors.reset}\n`);
        }
        break;
      }

      case '15': {
        // Typing indicator başlat
        let threadId = this.currentThreadId;
        if (!threadId) {
          const thread = await this.getOrCreateThread(otherUserId);
          if (thread) {
            threadId = thread.id;
            this.currentThreadId = threadId;
          } else {
            threadId = await this.promptInput('Thread ID: ');
          }
        }
        if (threadId) {
          await this.startTypingIndicator(threadId);
          console.log(`${colors.green}✅ Typing indicator başlatıldı${colors.reset}\n`);
        }
        break;
      }

      case '16': {
        // Typing indicator durdur
        let threadId = this.currentThreadId;
        if (!threadId) {
          threadId = await this.promptInput('Thread ID: ');
        }
        if (threadId) {
          await this.stopTypingIndicator(threadId);
          console.log(`${colors.green}✅ Typing indicator durduruldu${colors.reset}\n`);
        }
        break;
      }

      case '17': {
        // Thread oluştur/getir
        const thread = await this.getOrCreateThread(otherUserId);
        if (thread) {
          this.currentThreadId = thread.id;
          console.log(`${colors.green}✅ Thread hazır:${colors.reset}`);
          console.log(`   Thread ID: ${thread.id}`);
          console.log(`   Aktif: ${thread.isActive ? 'Evet' : 'Hayır'}\n`);
        }
        break;
      }

      case '0': {
        // Çıkış
        console.log(`${colors.yellow}👋 Çıkılıyor...${colors.reset}`);
        if (this.socket) {
          this.socket.disconnect();
        }
        this.rl.close();
        process.exit(0);
        break;
      }

      default:
        console.log(`${colors.red}❌ Geçersiz seçim!${colors.reset}\n`);
    }
  }

  /**
   * Kullanıcıdan input al
   */
  private promptInput(question: string): Promise<string> {
    return new Promise((resolve) => {
      this.rl.question(question, (answer) => {
        resolve(answer.trim());
      });
    });
  }

  /**
   * Simülasyonu başlat
   */
  async start(): Promise<void> {
    console.log(`${colors.bright}${colors.magenta}`);
    console.log('╔══════════════════════════════════════════════════════════╗');
    console.log('║     Julia-Omer Mesajlaşma Simülasyonu                    ║');
    console.log('║     Socket.IO + REST API + Notification Test            ║');
    console.log('╚══════════════════════════════════════════════════════════╝');
    console.log(colors.reset);
    console.log(`${colors.bright}${colors.yellow}⚠️  ÖNEMLİ UYARI:${colors.reset}`);
    console.log(`${colors.yellow}   Bu script TÜM işlemleri VERİTABANINA KALICI olarak yazar.${colors.reset}`);
    console.log(`${colors.yellow}   - Mesajlar → dm_messages tablosu${colors.reset}`);
    console.log(`${colors.yellow}   - Thread'ler → dm_threads tablosu${colors.reset}`);
    console.log(`${colors.yellow}   - Request'ler → dm_requests tablosu${colors.reset}`);
    console.log(`${colors.yellow}   - Tips → tips_token_transfers tablosu${colors.reset}`);
    console.log(`${colors.yellow}   - Notification'lar → notifications tablosu${colors.reset}`);
    console.log(`${colors.yellow}   Geçici veya test verisi oluşturulmaz!${colors.reset}\n`);

    // Login
    const loggedIn = await this.login();
    if (!loggedIn) {
      console.error(`${colors.red}❌ Giriş başarısız!${colors.reset}`);
      process.exit(1);
    }

    // Socket bağlantısı
    try {
      await this.connectSocket();
    } catch (error) {
      console.error(`${colors.red}❌ Socket bağlantısı kurulamadı!${colors.reset}`);
      console.log(`${colors.yellow}⚠️  Socket olmadan devam ediliyor (sadece REST API)...${colors.reset}\n`);
    }

    // Support Request'leri yükle
    await this.refreshSupportRequests();

    // Ana döngü
    while (true) {
      this.showMenu();
      await this.waitForInput();
    }
  }
}

// Main
async function main() {
  const args = process.argv.slice(2);
  const userArg = args[0] || 'julia';

  let userId: string;
  let userEmail: string;
  let userName: string;

  if (userArg.toLowerCase() === 'omer' || userArg.toLowerCase() === 'o') {
    userId = OMER_USER_ID;
    userEmail = OMER_EMAIL;
    userName = 'Omer';
  } else {
    userId = JULIA_USER_ID;
    userEmail = JULIA_EMAIL;
    userName = 'Julia';
  }

  const client = new SimulationClient(userId, userEmail, userName);
  await client.start();
}

// Script çalıştır
if (require.main === module) {
  main().catch((error) => {
    console.error(`${colors.red}❌ Fatal error:${colors.reset}`, error);
    process.exit(1);
  });
}

export { SimulationClient };

