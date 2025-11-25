/**
 * Socket.IO Messaging Test Script
 * 
 * Kullanım:
 * 1. JWT token'ınızı alın (login endpoint'inden)
 * 2. node test-socket.js <JWT_TOKEN> <SERVER_URL>
 * 
 * Örnek:
 * node test-socket.js "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." http://localhost:3000
 */

const { io } = require('socket.io-client');
const readline = require('readline');

const args = process.argv.slice(2);
const token = args[0];
const serverUrl = args[1] || 'http://localhost:3000';

if (!token) {
  console.error('❌ JWT token gerekli!');
  console.log('Kullanım: node test-socket.js <JWT_TOKEN> [SERVER_URL]');
  process.exit(1);
}

console.log('🔌 Socket.IO Test Başlatılıyor...');
console.log(`Server: ${serverUrl}`);
console.log('---\n');

// Socket bağlantısı
const socket = io(serverUrl, {
  auth: {
    token: token
  },
  transports: ['websocket', 'polling']
});

// Bağlantı event'leri
socket.on('connect', () => {
  console.log('✅ Socket bağlantısı kuruldu!');
  console.log(`Socket ID: ${socket.id}\n`);
});

socket.on('disconnect', (reason) => {
  console.log(`❌ Bağlantı kesildi: ${reason}`);
});

socket.on('connect_error', (error) => {
  console.error(`❌ Bağlantı hatası: ${error.message}`);
  process.exit(1);
});

socket.on('connected', (data) => {
  console.log('✅ Sunucu onayı:', JSON.stringify(data, null, 2));
});

// Mesajlaşma event'leri
socket.on('new_message', (data) => {
  console.log('\n📨 YENİ MESAJ ALINDI:');
  console.log(JSON.stringify(data, null, 2));
  console.log('---\n');
});

socket.on('message_sent', (data) => {
  console.log('\n✅ MESAJ GÖNDERİLDİ ONAYI:');
  console.log(JSON.stringify(data, null, 2));
  console.log('---\n');
});

socket.on('message_read', (data) => {
  console.log('\n👁️ MESAJ OKUNDU:');
  console.log(JSON.stringify(data, null, 2));
  console.log('---\n');
});

socket.on('user_typing', (data) => {
  const status = data.isTyping ? 'yazıyor...' : 'yazmayı durdurdu';
  console.log(`\n⌨️ Kullanıcı ${data.userId} ${status} (Thread: ${data.threadId})`);
  console.log('---\n');
});

socket.on('user_presence', (data) => {
  console.log(`\n👤 Kullanıcı ${data.userId} ${data.status}`);
  console.log('---\n');
});

// Thread event'leri
socket.on('thread_joined', (data) => {
  console.log(`\n✅ Thread'e katıldınız: ${data.threadId}`);
  console.log('---\n');
});

socket.on('thread_left', (data) => {
  console.log(`\n👋 Thread'den ayrıldınız: ${data.threadId}`);
  console.log('---\n');
});

socket.on('thread_join_error', (data) => {
  console.log(`\n❌ Thread hatası: ${data.reason} (Thread: ${data.threadId})`);
  console.log('---\n');
});

// Ping-pong
socket.on('pong', () => {
  console.log('🏓 Pong alındı');
});

// Komut satırı arayüzü
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  prompt: '> '
});

console.log('\nKomutlar:');
console.log('  join <threadId>     - Thread\'e katıl');
console.log('  leave <threadId>    - Thread\'den ayrıl');
console.log('  typing_start <threadId> - Yazma göstergesi başlat');
console.log('  typing_stop <threadId>  - Yazma göstergesi durdur');
console.log('  ping                - Ping gönder');
console.log('  quit                - Çıkış\n');

rl.prompt();

rl.on('line', (line) => {
  const [command, ...args] = line.trim().split(' ');
  
  switch (command) {
    case 'join':
      if (args[0]) {
        console.log(`Thread'e katılıyor: ${args[0]}`);
        socket.emit('join_thread', args[0]);
      } else {
        console.log('❌ Thread ID gerekli: join <threadId>');
      }
      break;
      
    case 'leave':
      if (args[0]) {
        console.log(`Thread'den ayrılıyor: ${args[0]}`);
        socket.emit('leave_thread', args[0]);
      } else {
        console.log('❌ Thread ID gerekli: leave <threadId>');
      }
      break;
      
    case 'typing_start':
      if (args[0]) {
        console.log(`Yazma göstergesi başlatılıyor: ${args[0]}`);
        socket.emit('typing_start', { threadId: args[0] });
      } else {
        console.log('❌ Thread ID gerekli: typing_start <threadId>');
      }
      break;
      
    case 'typing_stop':
      if (args[0]) {
        console.log(`Yazma göstergesi durduruluyor: ${args[0]}`);
        socket.emit('typing_stop', { threadId: args[0] });
      } else {
        console.log('❌ Thread ID gerekli: typing_stop <threadId>');
      }
      break;
      
    case 'ping':
      console.log('Ping gönderiliyor...');
      socket.emit('ping');
      break;
      
    case 'quit':
    case 'exit':
      console.log('Çıkılıyor...');
      socket.disconnect();
      rl.close();
      process.exit(0);
      break;
      
    default:
      if (command) {
        console.log(`❌ Bilinmeyen komut: ${command}`);
      }
  }
  
  rl.prompt();
});

rl.on('close', () => {
  socket.disconnect();
  process.exit(0);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\nÇıkılıyor...');
  socket.disconnect();
  rl.close();
  process.exit(0);
});


