import { io, Socket } from 'socket.io-client';
import * as readline from 'readline';

// Config
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const SOCKET_URL = process.env.SOCKET_URL || 'http://localhost:3000';

// Colors for terminal output
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

interface LoginResponse {
  id: string;
  email: string;
  token: string;
  fullName?: string;
}

interface UserInfo {
  id: string;
  email: string;
  name?: string;
}

class SocketChatTester {
  private socket: Socket | null = null;
  private token: string = '';
  private userId: string = '';
  private userEmail: string = '';
  private recipientId: string = '';
  private recipientEmail: string = 'omer@tipbox.co';
  private currentThreadId: string | null = null;
  private rl: readline.Interface;

  constructor() {
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
  }

  private log(message: string, color: string = colors.reset) {
    console.log(`${color}${message}${colors.reset}`);
  }

  private async login(email: string, password: string): Promise<LoginResponse> {
    this.log(`\n🔐 ${email} hesabına giriş yapılıyor...`, colors.cyan);

    try {
      const response = await fetch(`${BASE_URL}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        const error = (await response.json()) as { message?: string };
        const errorMessage = error?.message || 'Login failed';
        throw new Error(errorMessage);
      }

      const data = (await response.json()) as LoginResponse;
      this.token = data.token;
      this.userId = String(data.id);
      this.userEmail = data.email;

      this.log(`✅ Giriş başarılı!`, colors.green);
      this.log(`   User ID: ${this.userId}`, colors.cyan);
      this.log(`   Email: ${this.userEmail}`, colors.cyan);
      this.log(`   Name: ${data.fullName || 'N/A'}`, colors.cyan);

      return data;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.log(`❌ Giriş hatası: ${errorMessage}`, colors.red);
      throw error;
    }
  }

  private async findRecipientUserId(): Promise<string> {
    this.log(`\n🔍 ${this.recipientEmail} kullanıcısı aranıyor...`, colors.cyan);

    try {
      // Search endpoint'ini kullan
      const response = await fetch(
        `${BASE_URL}/search?keyword=${encodeURIComponent(this.recipientEmail)}&types=user&limit=10`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${this.token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Search failed: ${response.status}`);
      }

      const searchResult = (await response.json()) as { userData?: Array<{ id: string; name: string }> };
      const users = searchResult.userData || [];

      if (users.length === 0) {
        throw new Error('User not found in search results');
      }

      // İlk kullanıcıyı al ve detaylarını çek
      const firstUser = users[0];
      const userId = String(firstUser.id);

      // Kullanıcı detaylarını çek (email kontrolü için)
      const userDetailResponse = await fetch(`${BASE_URL}/users/${userId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.token}`,
          'Content-Type': 'application/json',
        },
      });

      if (userDetailResponse.ok) {
        const userDetail = (await userDetailResponse.json()) as { email?: string; name?: string };
        if (userDetail.email === this.recipientEmail) {
          this.recipientId = userId;
          this.log(`✅ Kullanıcı bulundu!`, colors.green);
          this.log(`   User ID: ${this.recipientId}`, colors.cyan);
          this.log(`   Name: ${userDetail.name || 'N/A'}`, colors.cyan);
          this.log(`   Email: ${userDetail.email}`, colors.cyan);
          return this.recipientId;
        }
      }

      // Email eşleşmezse ilk kullanıcıyı kullan
      this.recipientId = userId;
      this.log(`✅ Kullanıcı bulundu (ilk sonuç):`, colors.green);
      this.log(`   User ID: ${this.recipientId}`, colors.cyan);
      this.log(`   Name: ${firstUser.name || 'N/A'}`, colors.cyan);
      return this.recipientId;
    } catch (error: any) {
      this.log(`❌ Kullanıcı bulunamadı: ${error.message}`, colors.red);
      throw error;
    }
  }

  private async createOrGetThread(): Promise<string> {
    if (this.currentThreadId) {
      return this.currentThreadId;
    }

    this.log(`\n💬 Thread oluşturuluyor/alınıyor...`, colors.cyan);

    try {
      const response = await fetch(`${BASE_URL}/messages/threads`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ recipientId: this.recipientId }),
      });

      if (!response.ok) {
        throw new Error('Failed to create/get thread');
      }

      const thread = (await response.json()) as { id: string };
      this.currentThreadId = thread.id || null;
      if (!this.currentThreadId) {
        throw new Error('Thread ID not found in response');
      }
      this.log(`✅ Thread hazır!`, colors.green);
      this.log(`   Thread ID: ${this.currentThreadId}`, colors.cyan);
      return this.currentThreadId;
    } catch (error: any) {
      this.log(`❌ Thread oluşturma hatası: ${error.message}`, colors.red);
      throw error;
    }
  }

  private connectSocket(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.log(`\n🔌 Socket bağlantısı kuruluyor...`, colors.cyan);

      this.socket = io(SOCKET_URL, {
        auth: {
          token: this.token,
        },
        transports: ['websocket', 'polling'],
      });

      this.socket.on('connect', () => {
        this.log(`✅ Socket bağlantısı kuruldu!`, colors.green);
        this.log(`   Socket ID: ${this.socket?.id}`, colors.cyan);
        resolve();
      });

      this.socket.on('connected', (data) => {
        this.log(`📨 Connected event: ${JSON.stringify(data)}`, colors.blue);
      });

      this.socket.on('new_message', (data) => {
        this.log(`\n📩 YENİ MESAJ GELDİ:`, colors.magenta);
        this.log(`   Gönderen: ${data.senderId}`, colors.yellow);
        this.log(`   Mesaj: ${data.message}`, colors.yellow);
        this.log(`   Thread: ${data.threadId}`, colors.yellow);
        this.log(`   Zaman: ${data.timestamp}`, colors.yellow);
        this.showPrompt();
      });

      this.socket.on('message_sent', (data) => {
        this.log(`\n✅ Mesaj gönderildi:`, colors.green);
        this.log(`   Mesaj ID: ${data.messageId}`, colors.cyan);
        this.log(`   Thread: ${data.threadId}`, colors.cyan);
        this.showPrompt();
      });

      this.socket.on('message_read', (data) => {
        this.log(`\n👁️  Mesaj okundu:`, colors.blue);
        this.log(`   Mesaj ID: ${data.messageId}`, colors.cyan);
        this.log(`   Okuyan: ${data.readBy}`, colors.cyan);
        this.showPrompt();
      });

      this.socket.on('user_typing', (data) => {
        if (data.isTyping) {
          this.log(`\n⌨️  ${data.userId} yazıyor...`, colors.yellow);
        } else {
          this.log(`\n⌨️  ${data.userId} yazmayı bıraktı`, colors.yellow);
        }
        this.showPrompt();
      });

      this.socket.on('thread_joined', (data) => {
        this.log(`\n✅ Thread'e katıldınız: ${data.threadId}`, colors.green);
        this.showPrompt();
      });

      this.socket.on('thread_left', (data) => {
        this.log(`\n👋 Thread'den ayrıldınız: ${data.threadId}`, colors.blue);
        this.showPrompt();
      });

      this.socket.on('error', (error) => {
        this.log(`\n❌ Socket hatası: ${JSON.stringify(error)}`, colors.red);
        this.showPrompt();
      });

      this.socket.on('disconnect', (reason) => {
        this.log(`\n🔌 Bağlantı kesildi: ${reason}`, colors.red);
      });

      this.socket.on('connect_error', (error) => {
        this.log(`\n❌ Bağlantı hatası: ${error.message}`, colors.red);
        reject(error);
      });
    });
  }

  private async sendMessage(message: string): Promise<void> {
    if (!this.socket) {
      this.log(`❌ Socket bağlantısı yok!`, colors.red);
      return;
    }

    this.log(`\n📤 Mesaj gönderiliyor: "${message}"`, colors.cyan);

    this.socket.emit('send_message', {
      recipientId: this.recipientId,
      message: message,
    });
  }

  private async joinThread(): Promise<void> {
    if (!this.socket || !this.currentThreadId) {
      this.log(`❌ Thread ID yok!`, colors.red);
      return;
    }

    this.log(`\n📥 Thread'e katılıyorsunuz...`, colors.cyan);
    this.socket.emit('join_thread', { threadId: this.currentThreadId });
  }

  private async leaveThread(): Promise<void> {
    if (!this.socket || !this.currentThreadId) {
      this.log(`❌ Thread ID yok!`, colors.red);
      return;
    }

    this.log(`\n👋 Thread'den ayrılıyorsunuz...`, colors.cyan);
    this.socket.emit('leave_thread', { threadId: this.currentThreadId });
  }

  private async startTyping(): Promise<void> {
    if (!this.socket || !this.currentThreadId) {
      this.log(`❌ Thread ID yok!`, colors.red);
      return;
    }

    this.log(`\n⌨️  Yazıyor göstergesi başlatılıyor...`, colors.cyan);
    this.socket.emit('typing_start', { threadId: this.currentThreadId });
  }

  private async stopTyping(): Promise<void> {
    if (!this.socket || !this.currentThreadId) {
      this.log(`❌ Thread ID yok!`, colors.red);
      return;
    }

    this.log(`\n⌨️  Yazıyor göstergesi durduruluyor...`, colors.cyan);
    this.socket.emit('typing_stop', { threadId: this.currentThreadId });
  }

  private async markMessageRead(messageId: string): Promise<void> {
    if (!this.socket) {
      this.log(`❌ Socket bağlantısı yok!`, colors.red);
      return;
    }

    this.log(`\n👁️  Mesaj okundu işaretleniyor: ${messageId}`, colors.cyan);
    this.socket.emit('mark_message_read', { messageId });
  }

  private showPrompt() {
    process.stdout.write(`\n${colors.bright}${colors.cyan}[${this.userEmail}]${colors.reset} `);
  }

  private showHelp() {
    this.log(`\n📖 Komutlar:`, colors.bright);
    this.log(`   /help          - Bu yardım menüsünü gösterir`);
    this.log(`   /join          - Thread'e katıl`);
    this.log(`   /leave         - Thread'den ayrıl`);
    this.log(`   /typing        - Yazıyor göstergesi gönder (3 saniye)`);
    this.log(`   /read <id>     - Mesajı okundu işaretle`);
    this.log(`   /thread        - Thread ID'yi göster`);
    this.log(`   /info          - Bağlantı bilgilerini göster`);
    this.log(`   /quit          - Çıkış yap`);
    this.log(`   <mesaj>        - Mesaj gönder`);
  }

  private showInfo() {
    this.log(`\n📊 Bağlantı Bilgileri:`, colors.bright);
    this.log(`   User ID: ${this.userId}`, colors.cyan);
    this.log(`   Email: ${this.userEmail}`, colors.cyan);
    this.log(`   Recipient ID: ${this.recipientId}`, colors.cyan);
    this.log(`   Recipient Email: ${this.recipientEmail}`, colors.cyan);
    this.log(`   Thread ID: ${this.currentThreadId || 'Yok'}`, colors.cyan);
    this.log(`   Socket ID: ${this.socket?.id || 'Bağlı değil'}`, colors.cyan);
    this.log(`   Socket Connected: ${this.socket?.connected ? 'Evet' : 'Hayır'}`, colors.cyan);
  }

  private async handleCommand(input: string): Promise<boolean> {
    const parts = input.trim().split(' ');
    const command = parts[0].toLowerCase();

    switch (command) {
      case '/help':
        this.showHelp();
        return false;

      case '/join':
        await this.joinThread();
        return false;

      case '/leave':
        await this.leaveThread();
        return false;

      case '/typing':
        await this.startTyping();
        setTimeout(() => {
          this.stopTyping();
        }, 3000);
        return false;

      case '/read':
        if (parts[1]) {
          await this.markMessageRead(parts[1]);
        } else {
          this.log(`❌ Mesaj ID gerekli: /read <messageId>`, colors.red);
        }
        return false;

      case '/thread':
        this.log(`\n💬 Thread ID: ${this.currentThreadId || 'Yok'}`, colors.cyan);
        return false;

      case '/info':
        this.showInfo();
        return false;

      case '/quit':
      case '/exit':
        this.log(`\n👋 Çıkış yapılıyor...`, colors.yellow);
        return true;

      default:
        if (input.trim().length > 0) {
          await this.sendMessage(input);
        }
        return false;
    }
  }

  public async run() {
    try {
      // Julia hesabına login
      const juliaEmail = process.env.JULIA_EMAIL || 'julia.havk@tipbox.co';
      const juliaPassword = process.env.JULIA_PASSWORD || 'password123';

      await this.login(juliaEmail, juliaPassword);

      // Recipient ID'yi bul
      await this.findRecipientUserId();

      // Thread oluştur/al
      await this.createOrGetThread();

      // Socket bağlantısı kur
      await this.connectSocket();

      // Thread'e katıl
      await this.joinThread();

      this.log(`\n${colors.bright}${colors.green}✅ Hazır! Mesaj göndermeye başlayabilirsiniz.${colors.reset}`);
      this.log(`${colors.bright}${colors.yellow}💡 Yardım için /help yazın${colors.reset}\n`);

      // İlk mesajı gönder
      await this.sendMessage('Merhaba! Real-time test başladı 🚀');

      // Interactive loop
      this.showPrompt();
      this.rl.on('line', async (input: string) => {
        const shouldQuit = await this.handleCommand(input);
        if (!shouldQuit) {
          this.showPrompt();
        } else {
          this.rl.close();
          if (this.socket) {
            this.socket.disconnect();
          }
          process.exit(0);
        }
      });

    } catch (error: any) {
      this.log(`\n❌ Hata: ${error.message}`, colors.red);
      process.exit(1);
    }
  }
}

// Run
const tester = new SocketChatTester();
tester.run().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

