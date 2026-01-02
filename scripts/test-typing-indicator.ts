/**
 * Julia kullanıcısının Ömer kullanıcısına typing indicator göndermesi için test script
 * Saniyede 1 harf yazıyormuş gibi typing eventleri gönderir, mesaj göndermez
 */

import { io, Socket } from 'socket.io-client';
import axios from 'axios';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const SOCKET_URL = process.env.SOCKET_URL || 'http://localhost:3000';

const JULIA_EMAIL = 'julia.havk@tipbox.co';
const JULIA_PASSWORD = 'password123';
const OMER_EMAIL = 'omer@tipbox.co';

interface LoginResponse {
  id: string;
  email: string;
  token: string;
}

class TypingIndicatorTester {
  private socket: Socket | null = null;
  private token: string = '';
  private juliaUserId: string = '';
  private omerUserId: string = '';
  private threadId: string | null = null;
  private isRunning: boolean = false;

  private log(message: string) {
    console.log(`[${new Date().toLocaleTimeString()}] ${message}`);
  }

  private async login(): Promise<void> {
    this.log(`🔐 Julia ile login yapılıyor...`);
    
    try {
      const response = await axios.post<LoginResponse>(`${BASE_URL}/auth/login`, {
        email: JULIA_EMAIL,
        password: JULIA_PASSWORD,
      });
      
      this.token = response.data.token;
      this.juliaUserId = String(response.data.id);
      this.log(`✅ Login başarılı - Julia User ID: ${this.juliaUserId}`);
    } catch (error: any) {
      this.log(`❌ Login hatası: ${error.response?.data?.message || error.message}`);
      throw error;
    }
  }

  private async findOmerUserId(): Promise<void> {
    this.log(`🔍 Ömer kullanıcısı aranıyor...`);
    
    try {
      const response = await axios.get(`${BASE_URL}/search`, {
        params: {
          keyword: OMER_EMAIL,
          types: 'user',
          limit: 10,
        },
        headers: {
          Authorization: `Bearer ${this.token}`,
        },
      });
      
      const users = response.data?.userData || [];
      const omerUser = users.find((u: any) => 
        u.email === OMER_EMAIL || u.email?.toLowerCase().includes('omer')
      );
      
      if (omerUser) {
        this.omerUserId = String(omerUser.id);
        this.log(`✅ Ömer bulundu - User ID: ${this.omerUserId}`);
      } else {
        // Bilinen Ömer ID'sini kullan
        this.omerUserId = '480f5de9-b691-4d70-a6a8-2789226f4e07';
        this.log(`⚠️  Search'te bulunamadı, bilinen ID kullanılıyor: ${this.omerUserId}`);
      }
    } catch (error: any) {
      // Hata durumunda bilinen ID'yi kullan
      this.omerUserId = '480f5de9-b691-4d70-a6a8-2789226f4e07';
      this.log(`⚠️  Hata oluştu, bilinen ID kullanılıyor: ${this.omerUserId}`);
    }
  }

  private async createOrGetThread(): Promise<void> {
    this.log(`💬 Thread oluşturuluyor/alınıyor...`);
    
    try {
      const response = await axios.post(
        `${BASE_URL}/messages/threads`,
        { recipientId: this.omerUserId },
        {
          headers: {
            Authorization: `Bearer ${this.token}`,
            'Content-Type': 'application/json',
          },
        }
      );
      
      this.threadId = response.data.id;
      this.log(`✅ Thread hazır - Thread ID: ${this.threadId}`);
    } catch (error: any) {
      this.log(`❌ Thread oluşturma hatası: ${error.response?.data?.message || error.message}`);
      throw error;
    }
  }

  private connectSocket(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.log(`🔌 Socket bağlantısı kuruluyor...`);
      
      this.socket = io(SOCKET_URL, {
        auth: {
          token: this.token,
        },
        transports: ['websocket', 'polling'],
      });
      
      this.socket.on('connect', () => {
        this.log(`✅ Socket bağlantısı kuruldu - Socket ID: ${this.socket?.id}`);
        resolve();
      });
      
      this.socket.on('connected', (data) => {
        this.log(`📨 Connected event alındı`);
      });
      
      this.socket.on('user_typing', (data) => {
        if (data.isTyping) {
          this.log(`⌨️  ${data.userId} yazıyor...`);
        } else {
          this.log(`⌨️  ${data.userId} yazmayı bıraktı`);
        }
      });
      
      this.socket.on('thread_joined', (data) => {
        this.log(`✅ Thread'e katıldınız: ${data.threadId}`);
      });
      
      this.socket.on('error', (error) => {
        this.log(`❌ Socket hatası: ${JSON.stringify(error)}`);
      });
      
      this.socket.on('connect_error', (error) => {
        this.log(`❌ Bağlantı hatası: ${error.message}`);
        reject(error);
      });
    });
  }

  private async joinThread(): Promise<void> {
    if (!this.socket || !this.threadId) {
      throw new Error('Socket veya Thread ID yok');
    }
    
    this.log(`📥 Thread'e katılıyorsunuz...`);
    this.socket.emit('join_thread', { threadId: this.threadId });
    
    // Thread'e katılma onayını bekle
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  private async simulateTyping(): Promise<void> {
    if (!this.socket || !this.threadId) {
      throw new Error('Socket veya Thread ID yok');
    }
    
    this.isRunning = true;
    this.log(`\n⌨️  Typing simülasyonu başlatılıyor...`);
    this.log(`   Saniyede 1 harf yazıyormuş gibi typing eventleri gönderilecek`);
    this.log(`   Mesaj gönderilmeyecek, sadece typing indicator çalışacak\n`);
    
    // Örnek bir mesaj metni (sadece uzunluk için)
    const sampleMessage = "Merhaba Ömer, bu bir typing test mesajıdır. Mobilde typing indicator'ın çalışıp çalışmadığını test ediyorum.";
    const messageLength = sampleMessage.length;
    
    this.log(`📝 Simüle edilecek mesaj uzunluğu: ${messageLength} karakter`);
    this.log(`⏱️  Toplam süre: ~${messageLength} saniye\n`);
    
    // Her karakter için typing_start gönder, 1 saniye bekle, typing_stop gönder
    for (let i = 0; i < messageLength && this.isRunning; i++) {
      // Typing başlat
      this.socket.emit('typing_start', { threadId: this.threadId });
      this.log(`[${i + 1}/${messageLength}] Typing başlatıldı - "${sampleMessage[i]}"`);
      
      // 1 saniye bekle
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Typing durdur (son karakter değilse)
      if (i < messageLength - 1) {
        this.socket.emit('typing_stop', { threadId: this.threadId });
        // Kısa bir bekleme (yazmayı bırakma animasyonu için)
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }
    
    // Son typing'i durdur
    if (this.isRunning) {
      this.socket.emit('typing_stop', { threadId: this.threadId });
      this.log(`\n✅ Typing simülasyonu tamamlandı!`);
      this.log(`   Toplam ${messageLength} karakter simüle edildi`);
      this.log(`   Mobilde typing indicator'ın çalışıp çalışmadığını kontrol edin\n`);
    }
  }

  public async run(): Promise<void> {
    try {
      // 1. Login
      await this.login();
      
      // 2. Ömer kullanıcısını bul
      await this.findOmerUserId();
      
      // 3. Thread oluştur/al
      await this.createOrGetThread();
      
      // 4. Socket bağlantısı kur
      await this.connectSocket();
      
      // 5. Thread'e katıl
      await this.joinThread();
      
      // 6. Typing simülasyonu başlat
      await this.simulateTyping();
      
      // 7. Biraz bekle ve kapat
      this.log(`\n⏳ 5 saniye bekleniyor...`);
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      this.log(`\n👋 Bağlantı kapatılıyor...`);
      if (this.socket) {
        this.socket.disconnect();
      }
      
      this.log(`✅ Test tamamlandı!`);
      
    } catch (error: any) {
      this.log(`\n❌ Hata: ${error.message}`);
      if (error.stack) {
        this.log(`Stack: ${error.stack}`);
      }
      process.exit(1);
    }
  }

  public stop(): void {
    this.isRunning = false;
    if (this.socket) {
      this.socket.disconnect();
    }
  }
}

// Ctrl+C ile durdurma
process.on('SIGINT', () => {
  console.log('\n\n⚠️  Test durduruluyor...');
  process.exit(0);
});

// Script'i çalıştır
const tester = new TypingIndicatorTester();
tester.run().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});


