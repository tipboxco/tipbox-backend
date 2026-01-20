import axios from 'axios';
import * as readline from 'readline';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const OMER_EMAIL = 'omer@tipbox.co';
const OMER_PASSWORD = 'password123';

interface TestResult {
  name: string;
  success: boolean;
  message: string;
  data?: any;
}

interface InboxCLI {
  token: string;
  userId: string;
  rl: readline.Interface;
}

// Login function
async function login(email: string = OMER_EMAIL, password: string = OMER_PASSWORD): Promise<{ token: string; userId: string }> {
  try {
    const response = await axios.post(`${BASE_URL}/auth/login`, {
      email,
      password,
    });
    
    const token = response.data.token;
    const userId = response.data.id || response.data.user?.id;
    return { token, userId };
  } catch (error: any) {
    throw new Error(`Login failed: ${error.response?.data?.message || error.message}`);
  }
}

// API call helper
async function apiCall(
  method: 'get' | 'post' | 'patch' | 'delete' | 'put',
  endpoint: string,
  token: string,
  data?: any,
  formData?: any
): Promise<any> {
  const config: any = {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  };

  if (formData) {
    config.headers['Content-Type'] = 'multipart/form-data';
  } else {
    config.headers['Content-Type'] = 'application/json';
  }

  const url = `${BASE_URL}${endpoint}`;
  
  try {
    let response;
    switch (method) {
      case 'get':
        response = await axios.get(url, config);
        break;
      case 'post':
        response = await axios.post(url, formData || data, config);
        break;
      case 'patch':
        response = await axios.patch(url, data, config);
        break;
      case 'put':
        response = await axios.put(url, data, config);
        break;
      case 'delete':
        response = await axios.delete(url, config);
        break;
    }
    return { success: true, data: response.data, status: response.status };
  } catch (error: any) {
    return {
      success: false,
      message: error.response?.data?.message || error.message,
      status: error.response?.status,
      data: error.response?.data,
    };
  }
}

// Find user by email or name
async function findUser(searchTerm: string, token: string): Promise<any> {
  try {
    const response = await apiCall('get', `/search?keyword=${encodeURIComponent(searchTerm)}&types=user&limit=10`, token);
    if (response.success && response.data?.userData) {
      return response.data.userData;
    }
    return [];
  } catch {
    return [];
  }
}

// Delete Julia-Havka thread
async function deleteJuliaHavkaThread(cli: InboxCLI): Promise<void> {
  console.log('\n🔍 Julia-Havka thread\'i aranıyor...');
  
  // Find users
  const juliaUsers = await findUser('julia', cli.token);
  const havkaUsers = await findUser('havka', cli.token);
  
  let juliaId: string | null = null;
  let havkaId: string | null = null;
  
  // Julia ID: 99999999-9999-4999-9999-999999999999 (ozan@tipbox.co)
  const juliaUser = juliaUsers.find((u: any) => 
    u.id === '99999999-9999-4999-9999-999999999999' || 
    u.email?.toLowerCase().includes('julia') ||
    u.email?.toLowerCase().includes('ozan')
  );
  
  if (juliaUser) {
    juliaId = juliaUser.id;
    console.log(`✓ Julia bulundu: ${juliaUser.email || juliaUser.name} (${juliaId})`);
  } else {
    juliaId = '99999999-9999-4999-9999-999999999999';
    console.log(`⚠ Julia bulunamadı, direkt ID kullanılıyor: ${juliaId}`);
  }
  
  // Havka'yı bul
  const havkaUser = havkaUsers.find((u: any) => 
    u.email?.toLowerCase().includes('havka') ||
    u.name?.toLowerCase().includes('havka')
  );
  
  if (havkaUser) {
    havkaId = havkaUser.id;
    console.log(`✓ Havka bulundu: ${havkaUser.email || havkaUser.name} (${havkaId})`);
  } else {
    console.log('⚠ Havka bulunamadı');
  }
  
  if (!juliaId) {
    console.log('❌ Julia bulunamadı, thread silme işlemi atlanıyor');
    return;
  }
  
  // Get inbox to find thread
  const inboxResponse = await apiCall('get', '/inbox', cli.token);
  if (!inboxResponse.success) {
    console.log('❌ Inbox alınamadı');
    return;
  }
  
  const threads = inboxResponse.data || [];
  const juliaThread = threads.find((t: any) => 
    t.recipientUserId === juliaId || 
    (havkaId && t.recipientUserId === havkaId)
  );
  
  if (juliaThread) {
    console.log(`\n🗑️  Thread siliniyor: ${juliaThread.id}`);
    const deleteResponse = await apiCall('delete', `/inbox/threads/${juliaThread.id}`, cli.token);
    if (deleteResponse.success) {
      console.log('✅ Thread başarıyla silindi');
    } else {
      console.log(`❌ Thread silinemedi: ${deleteResponse.message}`);
    }
  } else {
    console.log('ℹ️  Julia-Havka thread\'i bulunamadı (zaten silinmiş olabilir)');
  }
}

// CLI Menu
function showMenu(): void {
  console.log('\n╔════════════════════════════════════════════════════════╗');
  console.log('║          INBOX CLI - Omer Kullanıcısı                 ║');
  console.log('╚════════════════════════════════════════════════════════╝');
  console.log('\n📋 Mevcut Komutlar:');
  console.log('  1.  Inbox listesi getir');
  console.log('  2.  Message feed getir');
  console.log('  3.  Thread oluştur/getir');
  console.log('  4.  Thread mesajlarını getir');
  console.log('  5.  Direkt mesaj gönder');
  console.log('  6.  Support request listesi');
  console.log('  7.  Support request oluştur');
  console.log('  8.  Support request accept');
  console.log('  9.  Support request reject');
  console.log('  10. TIPS gönder');
  console.log('  11. Mesaj düzenle');
  console.log('  12. Mesaj sil');
  console.log('  13. Reaksiyon ekle');
  console.log('  14. Reaksiyonları getir');
  console.log('  15. Reaksiyon sil');
  console.log('  16. Mesaj ara');
  console.log('  17. Medya yükle');
  console.log('  18. Thread sil');
  console.log('  19. Julia-Havka thread\'ini sil');
  console.log('  20. Tüm endpoint\'leri test et');
  console.log('  0.  Çıkış');
  console.log('\n');
}

// CLI handlers
async function handleGetInbox(cli: InboxCLI): Promise<void> {
  const search = await question(cli.rl, 'Arama terimi (boş bırakabilirsiniz): ');
  const unreadOnly = await question(cli.rl, 'Sadece okunmamış? (y/n): ');
  const threadType = await question(cli.rl, 'Thread tipi (DM/SUPPORT/ALL): ');
  
  let endpoint = '/inbox?';
  if (search) endpoint += `search=${encodeURIComponent(search)}&`;
  if (unreadOnly.toLowerCase() === 'y') endpoint += 'unreadOnly=true&';
  if (threadType) endpoint += `threadType=${threadType}&`;
  endpoint = endpoint.replace(/&$/, '');
  
  const result = await apiCall('get', endpoint, cli.token);
  if (result.success) {
    console.log(`\n✅ Başarılı - ${Array.isArray(result.data) ? result.data.length : 0} thread bulundu`);
    if (Array.isArray(result.data) && result.data.length > 0) {
      console.log('\n📬 Thread\'ler:');
      result.data.slice(0, 5).forEach((thread: any, index: number) => {
        console.log(`\n  ${index + 1}. ${thread.senderName || 'Bilinmeyen'}`);
        console.log(`     ID: ${thread.id}`);
        console.log(`     Son mesaj: ${thread.lastMessage || 'Yok'}`);
        console.log(`     Okunmamış: ${thread.unreadCount || 0}`);
        console.log(`     Tip: ${thread.threadType || 'DM'}`);
      });
    }
  } else {
    console.log(`\n❌ Hata: ${result.message}`);
  }
}

async function handleGetFeed(cli: InboxCLI): Promise<void> {
  const limit = await question(cli.rl, 'Limit (default: 50): ');
  const endpoint = `/inbox/feed${limit ? `?limit=${limit}` : ''}`;
  
  const result = await apiCall('get', endpoint, cli.token);
  if (result.success) {
    console.log(`\n✅ Başarılı - ${result.data?.messages?.length || 0} feed item`);
  } else {
    console.log(`\n❌ Hata: ${result.message}`);
  }
}

async function handleCreateThread(cli: InboxCLI): Promise<void> {
  const recipientEmail = await question(cli.rl, 'Alıcı email veya isim: ');
  
  // Find user
  const users = await findUser(recipientEmail, cli.token);
  if (users.length === 0) {
    console.log('❌ Kullanıcı bulunamadı');
    return;
  }
  
  console.log('\n📋 Bulunan kullanıcılar:');
  users.slice(0, 5).forEach((user: any, index: number) => {
    console.log(`  ${index + 1}. ${user.name || user.email} (${user.email})`);
  });
  
  const choice = await question(cli.rl, 'Kullanıcı numarası seçin: ');
  const selectedUser = users[parseInt(choice) - 1];
  
  if (!selectedUser) {
    console.log('❌ Geçersiz seçim');
    return;
  }
  
  const result = await apiCall('post', '/inbox/threads', cli.token, {
    recipientId: selectedUser.id,
  });
  
  if (result.success) {
    console.log(`\n✅ Thread oluşturuldu/getirildi: ${result.data.id}`);
    console.log(`   User One: ${result.data.userOneId}`);
    console.log(`   User Two: ${result.data.userTwoId}`);
  } else {
    console.log(`\n❌ Hata: ${result.message}`);
  }
}

async function handleGetThreadMessages(cli: InboxCLI): Promise<void> {
  const threadId = await question(cli.rl, 'Thread ID: ');
  const limit = await question(cli.rl, 'Limit (default: 50): ');
  const offset = await question(cli.rl, 'Offset (default: 0): ');
  
  let endpoint = `/inbox/${threadId}?`;
  if (limit) endpoint += `limit=${limit}&`;
  if (offset) endpoint += `offset=${offset}&`;
  endpoint = endpoint.replace(/&$/, '');
  
  const result = await apiCall('get', endpoint, cli.token);
  if (result.success) {
    console.log(`\n✅ Başarılı - ${Array.isArray(result.data) ? result.data.length : 0} mesaj`);
    if (Array.isArray(result.data) && result.data.length > 0) {
      result.data.slice(0, 3).forEach((item: any, index: number) => {
        console.log(`\n  ${index + 1}. [${item.type}] ${item.data?.message || item.data?.lastMessage || 'N/A'}`);
      });
    }
  } else {
    console.log(`\n❌ Hata: ${result.message}`);
  }
}

async function handleSendMessage(cli: InboxCLI): Promise<void> {
  const recipientEmail = await question(cli.rl, 'Alıcı email veya isim: ');
  const message = await question(cli.rl, 'Mesaj: ');
  
  // Find user
  const users = await findUser(recipientEmail, cli.token);
  if (users.length === 0) {
    console.log('❌ Kullanıcı bulunamadı');
    return;
  }
  
  const selectedUser = users[0];
  
  const result = await apiCall('post', '/inbox', cli.token, {
    recipientUserId: selectedUser.id,
    message,
  });
  
  if (result.success) {
    console.log('\n✅ Mesaj gönderildi');
  } else {
    console.log(`\n❌ Hata: ${result.message}`);
  }
}

async function handleEditMessage(cli: InboxCLI): Promise<void> {
  const messageId = await question(cli.rl, 'Mesaj ID: ');
  const newMessage = await question(cli.rl, 'Yeni mesaj: ');
  
  const result = await apiCall('patch', `/inbox/${messageId}`, cli.token, {
    message: newMessage,
  });
  
  if (result.success) {
    console.log(`\n✅ Mesaj düzenlendi: ${result.data.messageId}`);
    console.log(`   Düzenlenme zamanı: ${result.data.editedAt}`);
  } else {
    console.log(`\n❌ Hata: ${result.message}`);
  }
}

async function handleDeleteMessage(cli: InboxCLI): Promise<void> {
  const messageId = await question(cli.rl, 'Mesaj ID: ');
  
  const result = await apiCall('delete', `/inbox/${messageId}`, cli.token);
  if (result.success) {
    console.log(`\n✅ Mesaj silindi: ${result.data.messageId}`);
  } else {
    console.log(`\n❌ Hata: ${result.message}`);
  }
}

async function handleAddReaction(cli: InboxCLI): Promise<void> {
  const messageId = await question(cli.rl, 'Mesaj ID: ');
  const emoji = await question(cli.rl, 'Emoji: ');
  
  const result = await apiCall('post', `/inbox/${messageId}/reactions`, cli.token, {
    emoji,
  });
  
  if (result.success) {
    console.log(`\n✅ Reaksiyon eklendi: ${emoji}`);
  } else {
    console.log(`\n❌ Hata: ${result.message}`);
  }
}

async function handleGetReactions(cli: InboxCLI): Promise<void> {
  const messageId = await question(cli.rl, 'Mesaj ID: ');
  
  const result = await apiCall('get', `/inbox/${messageId}/reactions`, cli.token);
  if (result.success) {
    console.log(`\n✅ Reaksiyonlar:`);
    result.data.reactions?.forEach((r: any) => {
      console.log(`  ${r.emoji}: ${r.count} (${r.users?.length || 0} kullanıcı)`);
    });
  } else {
    console.log(`\n❌ Hata: ${result.message}`);
  }
}

async function handleRemoveReaction(cli: InboxCLI): Promise<void> {
  const messageId = await question(cli.rl, 'Mesaj ID: ');
  const reactionId = await question(cli.rl, 'Reaksiyon ID: ');
  
  const result = await apiCall('delete', `/inbox/${messageId}/reactions/${reactionId}`, cli.token);
  if (result.success) {
    console.log(`\n✅ Reaksiyon silindi`);
  } else {
    console.log(`\n❌ Hata: ${result.message}`);
  }
}

async function handleSearchMessages(cli: InboxCLI): Promise<void> {
  const threadId = await question(cli.rl, 'Thread ID: ');
  const query = await question(cli.rl, 'Arama sorgusu: ');
  
  const result = await apiCall('get', `/inbox/threads/${threadId}/search?q=${encodeURIComponent(query)}`, cli.token);
  if (result.success) {
    console.log(`\n✅ ${result.data.total || 0} sonuç bulundu`);
    result.data.messages?.slice(0, 5).forEach((msg: any, index: number) => {
      console.log(`  ${index + 1}. ${msg.message}`);
    });
  } else {
    console.log(`\n❌ Hata: ${result.message}`);
  }
}

async function handleUploadMedia(cli: InboxCLI): Promise<void> {
  console.log('⚠️  Medya yükleme henüz implement edilmedi (form-data gerekiyor)');
  console.log('   Manuel olarak curl veya Postman kullanabilirsiniz:');
  console.log(`   curl -X POST ${BASE_URL}/inbox/threads/{threadId}/media \\`);
  console.log('     -H "Authorization: Bearer TOKEN" \\');
  console.log('     -F "media=@file.jpg" \\');
  console.log('     -F "mediaType=image" \\');
  console.log('     -F "caption=Caption text"');
}

async function handleDeleteThread(cli: InboxCLI): Promise<void> {
  const threadId = await question(cli.rl, 'Thread ID: ');
  
  const result = await apiCall('delete', `/inbox/threads/${threadId}`, cli.token);
  if (result.success) {
    console.log('\n✅ Thread silindi');
  } else {
    console.log(`\n❌ Hata: ${result.message}`);
  }
}

async function handleSupportRequests(cli: InboxCLI): Promise<void> {
  const result = await apiCall('get', '/inbox/support-requests', cli.token);
  if (result.success) {
    console.log(`\n✅ ${Array.isArray(result.data) ? result.data.length : 0} support request`);
  } else {
    console.log(`\n❌ Hata: ${result.message}`);
  }
}

async function handleCreateSupportRequest(cli: InboxCLI): Promise<void> {
  const recipientEmail = await question(cli.rl, 'Alıcı email: ');
  const type = await question(cli.rl, 'Tip (GENERAL/TECHNICAL/PRODUCT): ');
  const message = await question(cli.rl, 'Mesaj: ');
  const amount = await question(cli.rl, 'Miktar: ');
  
  const users = await findUser(recipientEmail, cli.token);
  if (users.length === 0) {
    console.log('❌ Kullanıcı bulunamadı');
    return;
  }
  
  const result = await apiCall('post', '/inbox/support-requests', cli.token, {
    senderUserId: cli.userId,
    recipientUserId: users[0].id,
    type: type.toUpperCase(),
    message,
    amount,
    status: 'pending',
    timestamp: new Date().toISOString(),
  });
  
  if (result.success) {
    console.log('\n✅ Support request oluşturuldu');
  } else {
    console.log(`\n❌ Hata: ${result.message}`);
  }
}

async function handleAcceptSupportRequest(cli: InboxCLI): Promise<void> {
  const requestId = await question(cli.rl, 'Request ID: ');
  
  const result = await apiCall('post', `/inbox/support-requests/${requestId}/accept`, cli.token);
  if (result.success) {
    console.log(`\n✅ Support request accept edildi`);
    console.log(`   Thread ID: ${result.data.threadId}`);
  } else {
    console.log(`\n❌ Hata: ${result.message}`);
  }
}

async function handleRejectSupportRequest(cli: InboxCLI): Promise<void> {
  const requestId = await question(cli.rl, 'Request ID: ');
  
  const result = await apiCall('post', `/inbox/support-requests/${requestId}/reject`, cli.token);
  if (result.success) {
    console.log('\n✅ Support request reject edildi');
  } else {
    console.log(`\n❌ Hata: ${result.message}`);
  }
}

async function handleSendTips(cli: InboxCLI): Promise<void> {
  const recipientEmail = await question(cli.rl, 'Alıcı email: ');
  const amount = await question(cli.rl, 'Miktar: ');
  const message = await question(cli.rl, 'Mesaj (opsiyonel): ');
  
  const users = await findUser(recipientEmail, cli.token);
  if (users.length === 0) {
    console.log('❌ Kullanıcı bulunamadı');
    return;
  }
  
  const result = await apiCall('post', '/inbox/tips', cli.token, {
    senderUserId: cli.userId,
    recipientUserId: users[0].id,
    amount: parseFloat(amount),
    message: message || '',
    timestamp: new Date().toISOString(),
  });
  
  if (result.success) {
    console.log('\n✅ TIPS gönderildi');
  } else {
    console.log(`\n❌ Hata: ${result.message}`);
  }
}

async function runAllTests(cli: InboxCLI): Promise<void> {
  console.log('\n🧪 Tüm endpoint\'ler test ediliyor...\n');
  
  const tests = [
    { name: 'GET /inbox', fn: () => apiCall('get', '/inbox', cli.token) },
    { name: 'GET /inbox/feed', fn: () => apiCall('get', '/inbox/feed', cli.token) },
    { name: 'GET /inbox/support-requests', fn: () => apiCall('get', '/inbox/support-requests', cli.token) },
  ];
  
  for (const test of tests) {
    try {
      const result = await test.fn();
      if (result.success) {
        console.log(`✅ ${test.name} - Başarılı`);
      } else {
        console.log(`❌ ${test.name} - ${result.message}`);
      }
    } catch (error: any) {
      console.log(`❌ ${test.name} - ${error.message}`);
    }
  }
  
  console.log('\n✅ Test tamamlandı');
}

// Helper function for readline questions
function question(rl: readline.Interface, query: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(query, resolve);
  });
}

// Main CLI loop
async function main() {
  console.log('🔐 Omer kullanıcısı ile giriş yapılıyor...');
  
  try {
    const { token, userId } = await login();
    console.log(`✅ Giriş başarılı - User ID: ${userId}\n`);
    
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    
    const cli: InboxCLI = { token, userId, rl };
    
    // Delete Julia-Havka thread on startup
    await deleteJuliaHavkaThread(cli);
    
    while (true) {
      showMenu();
      const choice = await question(rl, 'Seçiminiz: ');
      
      try {
        switch (choice.trim()) {
          case '1':
            await handleGetInbox(cli);
            break;
          case '2':
            await handleGetFeed(cli);
            break;
          case '3':
            await handleCreateThread(cli);
            break;
          case '4':
            await handleGetThreadMessages(cli);
            break;
          case '5':
            await handleSendMessage(cli);
            break;
          case '6':
            await handleSupportRequests(cli);
            break;
          case '7':
            await handleCreateSupportRequest(cli);
            break;
          case '8':
            await handleAcceptSupportRequest(cli);
            break;
          case '9':
            await handleRejectSupportRequest(cli);
            break;
          case '10':
            await handleSendTips(cli);
            break;
          case '11':
            await handleEditMessage(cli);
            break;
          case '12':
            await handleDeleteMessage(cli);
            break;
          case '13':
            await handleAddReaction(cli);
            break;
          case '14':
            await handleGetReactions(cli);
            break;
          case '15':
            await handleRemoveReaction(cli);
            break;
          case '16':
            await handleSearchMessages(cli);
            break;
          case '17':
            await handleUploadMedia(cli);
            break;
          case '18':
            await handleDeleteThread(cli);
            break;
          case '19':
            await deleteJuliaHavkaThread(cli);
            break;
          case '20':
            await runAllTests(cli);
            break;
          case '0':
            console.log('\n👋 Görüşmek üzere!');
            rl.close();
            process.exit(0);
          default:
            console.log('\n❌ Geçersiz seçim');
        }
      } catch (error: any) {
        console.log(`\n❌ Hata: ${error.message}`);
      }
      
      await question(rl, '\nDevam etmek için Enter\'a basın...');
    }
  } catch (error: any) {
    console.error(`\n❌ Giriş hatası: ${error.message}`);
    process.exit(1);
  }
}

// Run CLI
if (require.main === module) {
  main().catch(console.error);
}
