/**
 * Support Chat Test Scripti
 * 
 * Bu script şunları test eder:
 * 1. Support request oluşturma
 * 2. Support request'i accept etme
 * 3. Support chat thread ID'yi alma
 * 4. İki kullanıcı arasında support chat üzerinden mesajlaşma (socket)
 * 5. DB'de mesajların doğru support thread ID'ye yazıldığını kontrol etme
 * 
 * Kullanım:
 * USER1_TOKEN=xxx USER2_TOKEN=yyy node test-support-chat.js
 */

const { io } = require('socket.io-client');
const axios = require('axios');

const BASE_URL = process.env.API_URL || 'http://localhost:3000';

async function getUsersFromDB() {
  try {
    const { exec } = require('child_process');
    return new Promise((resolve, reject) => {
      exec(
        'docker exec tipbox_postgres psql -U postgres -d tipbox_dev -t -c "SELECT id, email FROM users LIMIT 2;"',
        (error, stdout, stderr) => {
          if (error) {
            reject(error);
            return;
          }
          const lines = stdout.trim().split('\n').filter(l => l.trim());
          const users = lines.map(line => {
            const [id, email] = line.split('|').map(s => s.trim());
            return { id, email };
          });
          resolve(users);
        }
      );
    });
  } catch (error) {
    console.error('❌ DB\'den kullanıcı çekme hatası:', error.message);
    return [];
  }
}

async function createSupportRequest(token, recipientUserId, type, message, amount) {
  try {
    const response = await axios.post(
      `${BASE_URL}/messages/support-requests`,
      {
        senderUserId: null, // JWT'den alınacak
        recipientUserId,
        type,
        message,
        amount: amount.toString(),
        status: 'pending',
        timestamp: new Date().toISOString()
      },
      { headers: { Authorization: `Bearer ${token}` } }
    );
    return response.data;
  } catch (error) {
    console.error('❌ Support request oluşturma hatası:', error.response?.data || error.message);
    throw error;
  }
}

async function acceptSupportRequest(token, requestId) {
  try {
    const response = await axios.post(
      `${BASE_URL}/messages/support-requests/${requestId}/accept`,
      {},
      { headers: { Authorization: `Bearer ${token}` } }
    );
    return response.data;
  } catch (error) {
    console.error('❌ Support request accept hatası:', error.response?.data || error.message);
    throw error;
  }
}

async function getSupportRequestThreadId(requestId) {
  const { exec } = require('child_process');
  return new Promise((resolve, reject) => {
    exec(
      `docker exec tipbox_postgres psql -U postgres -d tipbox_dev -t -c "SELECT thread_id FROM dm_requests WHERE id = '${requestId}';"`,
      (error, stdout, stderr) => {
        if (error) {
          reject(error);
          return;
        }
        const threadId = stdout.trim();
        resolve(threadId || null);
      }
    );
  });
}

function createSocket(token) {
  return new Promise((resolve, reject) => {
    const socket = io(BASE_URL, {
      auth: { token },
      transports: ['websocket', 'polling']
    });

    socket.on('connect', () => {
      console.log('✅ Socket bağlandı');
      resolve(socket);
    });

    socket.on('connect_error', (error) => {
      console.error('❌ Socket bağlantı hatası:', error.message);
      reject(error);
    });

    socket.on('connected', (data) => {
      console.log('✅ Socket authenticated');
    });
  });
}

async function sendSupportMessage(socket, threadId, message) {
  return new Promise((resolve, reject) => {
    socket.once('message_sent', (data) => {
      console.log('✅ Support mesajı gönderildi:', data.messageId);
      resolve(data);
    });

    socket.once('message_send_error', (error) => {
      console.error('❌ Support mesaj gönderme hatası:', error);
      reject(error);
    });

    socket.emit('send_support_message', { threadId, message });
  });
}

async function checkMessageInDB(messageText, expectedThreadId) {
  const { exec } = require('child_process');
  return new Promise((resolve, reject) => {
    exec(
      `docker exec tipbox_postgres psql -U postgres -d tipbox_dev -t -c "SELECT id, message, thread_id, context, sender_id FROM dm_messages WHERE message LIKE '%${messageText}%' ORDER BY sent_at DESC LIMIT 1;"`,
      (error, stdout, stderr) => {
        if (error) {
          reject(error);
          return;
        }
        const line = stdout.trim();
        if (line) {
          const parts = line.split('|').map(s => s.trim());
          resolve({
            id: parts[0],
            message: parts[1],
            threadId: parts[2],
            context: parts[3],
            senderId: parts[4]
          });
        } else {
          resolve(null);
        }
      }
    );
  });
}

async function checkThreadInDB(threadId) {
  const { exec } = require('child_process');
  return new Promise((resolve, reject) => {
    exec(
      `docker exec tipbox_postgres psql -U postgres -d tipbox_dev -t -c "SELECT id, is_support_thread, user_one_id, user_two_id FROM dm_threads WHERE id = '${threadId}';"`,
      (error, stdout, stderr) => {
        if (error) {
          reject(error);
          return;
        }
        const line = stdout.trim();
        if (line) {
          const parts = line.split('|').map(s => s.trim());
          resolve({
            id: parts[0],
            isSupportThread: parts[1],
            userOneId: parts[2],
            userTwoId: parts[3]
          });
        } else {
          resolve(null);
        }
      }
    );
  });
}

async function main() {
  console.log('🧪 Support Chat Test Başlatılıyor...\n');

  try {
    // 1. Kullanıcıları DB'den al
    console.log('1️⃣  Kullanıcıları DB\'den alınıyor...');
    const users = await getUsersFromDB();
    if (users.length < 2) {
      console.error('❌ En az 2 kullanıcı bulunmalı');
      process.exit(1);
    }
    const user1 = users[0];
    const user2 = users[1];
    console.log(`   ✅ User 1: ${user1.email} (${user1.id})`);
    console.log(`   ✅ User 2: ${user2.email} (${user2.id})\n`);

    // 2. Token'ları al
    const user1Token = process.env.USER1_TOKEN;
    const user2Token = process.env.USER2_TOKEN;
    
    if (!user1Token || !user2Token) {
      console.error('❌ USER1_TOKEN ve USER2_TOKEN environment variable\'larını ayarlayın');
      console.log('   Örnek: USER1_TOKEN=xxx USER2_TOKEN=yyy node test-support-chat.js');
      process.exit(1);
    }

    // 3. Support request oluştur
    console.log('2️⃣  Support Request Oluşturma');
    console.log('   📤 Support request oluşturuluyor...');
    
    const requestId = await new Promise(async (resolve, reject) => {
      try {
        await createSupportRequest(
          user1Token,
          user2.id,
          'GENERAL',
          'Test support request - Support chat testi',
          50.00
        );
        
        // Request ID'yi al
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const { exec } = require('child_process');
        exec(
          `docker exec tipbox_postgres psql -U postgres -d tipbox_dev -t -c "SELECT id FROM dm_requests WHERE from_user_id = '${user1.id}' AND to_user_id = '${user2.id}' ORDER BY sent_at DESC LIMIT 1;"`,
          (error, stdout, stderr) => {
            if (error) {
              reject(error);
              return;
            }
            const requestId = stdout.trim();
            resolve(requestId || null);
          }
        );
      } catch (error) {
        reject(error);
      }
    });
    
    if (!requestId) {
      console.log('   ❌ Oluşturulan support request bulunamadı!');
      return;
    }
    
    console.log(`   ✅ Support request ID: ${requestId}`);

    // 4. Support request'i accept et
    console.log('\n3️⃣  Support Request Accept');
    console.log('   ✅ Support request accept ediliyor...');
    
    const acceptResponse = await acceptSupportRequest(user2Token, requestId);
    console.log(`   ✅ Accept response:`, acceptResponse);
    
    const supportThreadId = acceptResponse.threadId;
    console.log(`   ✅ Support Thread ID: ${supportThreadId}`);
    
    // DB'de threadId'nin güncellendiğini kontrol et
    await new Promise(resolve => setTimeout(resolve, 1000));
    const dbThreadId = await getSupportRequestThreadId(requestId);
    if (dbThreadId && dbThreadId === supportThreadId) {
      console.log(`   ✅ DB'de threadId güncellendi: ${dbThreadId}`);
    } else {
      console.log(`   ❌ DB'de threadId güncellenmedi! (DB: ${dbThreadId}, Expected: ${supportThreadId})`);
    }
    
    // Thread'in DB'de olup olmadığını kontrol et
    const thread = await checkThreadInDB(supportThreadId);
    if (thread) {
      console.log(`   ✅ Thread DB'de bulundu:`, thread);
      if (thread.isSupportThread === 't' || thread.isSupportThread === 'true') {
        console.log('   ✅ Thread is_support_thread = true (doğru)');
      } else {
        console.log('   ❌ Thread is_support_thread = false (yanlış!)');
      }
    } else {
      console.log('   ❌ Thread DB\'de bulunamadı!');
    }

    // 5. Support chat mesajlaşma testi
    console.log('\n4️⃣  Support Chat Mesajlaşma Testi');
    
    // Socket bağlantıları oluştur
    console.log('   🔌 Socket bağlantıları oluşturuluyor...');
    const socket1 = await createSocket(user1Token);
    const socket2 = await createSocket(user2Token);
    
    // Thread'e katıl
    console.log(`   📥 Thread'e katılıyor: ${supportThreadId}`);
    socket1.emit('join_thread', supportThreadId);
    socket2.emit('join_thread', supportThreadId);
    
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // User1'den mesaj gönder
    console.log('   📤 User1 mesaj gönderiyor...');
    const message1 = `Support chat mesajı 1 - ${new Date().toISOString()}`;
    const sent1 = await sendSupportMessage(socket1, supportThreadId, message1);
    console.log(`   ✅ Mesaj 1 gönderildi: ${sent1.messageId}`);
    
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // User2'den mesaj gönder
    console.log('   📤 User2 mesaj gönderiyor...');
    const message2 = `Support chat mesajı 2 - ${new Date().toISOString()}`;
    const sent2 = await sendSupportMessage(socket2, supportThreadId, message2);
    console.log(`   ✅ Mesaj 2 gönderildi: ${sent2.messageId}`);
    
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // User1'den tekrar mesaj gönder
    console.log('   📤 User1 tekrar mesaj gönderiyor...');
    const message3 = `Support chat mesajı 3 - ${new Date().toISOString()}`;
    const sent3 = await sendSupportMessage(socket1, supportThreadId, message3);
    console.log(`   ✅ Mesaj 3 gönderildi: ${sent3.messageId}`);

    // 6. DB kontrolü
    console.log('\n5️⃣  DB Kontrolü');
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Mesaj 1 kontrolü
    console.log('   🔍 Mesaj 1 kontrol ediliyor...');
    const dbMessage1 = await checkMessageInDB(message1.substring(0, 20), supportThreadId);
    if (dbMessage1) {
      console.log('   📊 Mesaj 1:', dbMessage1);
      if (dbMessage1.threadId === supportThreadId) {
        console.log(`   ✅ Mesaj 1 doğru thread ID'ye yazıldı: ${dbMessage1.threadId}`);
      } else {
        console.log(`   ❌ Mesaj 1 yanlış thread ID'ye yazıldı! (Expected: ${supportThreadId}, Actual: ${dbMessage1.threadId})`);
      }
      if (dbMessage1.context === 'SUPPORT') {
        console.log('   ✅ Mesaj 1 context = SUPPORT (doğru)');
      } else {
        console.log(`   ❌ Mesaj 1 context = ${dbMessage1.context} (SUPPORT olmalı!)`);
      }
    } else {
      console.log('   ❌ Mesaj 1 DB\'de bulunamadı!');
    }
    
    // Mesaj 2 kontrolü
    console.log('   🔍 Mesaj 2 kontrol ediliyor...');
    const dbMessage2 = await checkMessageInDB(message2.substring(0, 20), supportThreadId);
    if (dbMessage2) {
      console.log('   📊 Mesaj 2:', dbMessage2);
      if (dbMessage2.threadId === supportThreadId) {
        console.log(`   ✅ Mesaj 2 doğru thread ID'ye yazıldı: ${dbMessage2.threadId}`);
      } else {
        console.log(`   ❌ Mesaj 2 yanlış thread ID'ye yazıldı! (Expected: ${supportThreadId}, Actual: ${dbMessage2.threadId})`);
      }
      if (dbMessage2.context === 'SUPPORT') {
        console.log('   ✅ Mesaj 2 context = SUPPORT (doğru)');
      } else {
        console.log(`   ❌ Mesaj 2 context = ${dbMessage2.context} (SUPPORT olmalı!)`);
      }
    } else {
      console.log('   ❌ Mesaj 2 DB\'de bulunamadı!');
    }
    
    // Mesaj 3 kontrolü
    console.log('   🔍 Mesaj 3 kontrol ediliyor...');
    const dbMessage3 = await checkMessageInDB(message3.substring(0, 20), supportThreadId);
    if (dbMessage3) {
      console.log('   📊 Mesaj 3:', dbMessage3);
      if (dbMessage3.threadId === supportThreadId) {
        console.log(`   ✅ Mesaj 3 doğru thread ID'ye yazıldı: ${dbMessage3.threadId}`);
      } else {
        console.log(`   ❌ Mesaj 3 yanlış thread ID'ye yazıldı! (Expected: ${supportThreadId}, Actual: ${dbMessage3.threadId})`);
      }
      if (dbMessage3.context === 'SUPPORT') {
        console.log('   ✅ Mesaj 3 context = SUPPORT (doğru)');
      } else {
        console.log(`   ❌ Mesaj 3 context = ${dbMessage3.context} (SUPPORT olmalı!)`);
      }
    } else {
      console.log('   ❌ Mesaj 3 DB\'de bulunamadı!');
    }

    // Socket'leri kapat
    socket1.disconnect();
    socket2.disconnect();

    console.log('\n✅ Test tamamlandı!');
    
  } catch (error) {
    console.error('❌ Test hatası:', error);
    process.exit(1);
  }
}

main();
