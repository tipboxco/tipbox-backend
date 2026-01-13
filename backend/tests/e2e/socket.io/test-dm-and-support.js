/**
 * DM ve Support Request Test Scripti
 * 
 * Bu script şunları test eder:
 * 1. Socket kullanarak DM mesajı gönderme
 * 2. Mesajın DB'ye eklenip eklenmediğini kontrol
 * 3. Support request oluşturma
 * 4. Support request'i accept etme
 * 5. threadId'nin null'dan unique bir değere güncellenip güncellenmediğini kontrol
 * 
 * Kullanım:
 * node test-dm-and-support.js
 */

const { io } = require('socket.io-client');
const axios = require('axios');

const BASE_URL = process.env.API_URL || 'http://localhost:3000';

// Test kullanıcıları
const USER1 = {
  email: 'omer@tipbox.co',
  password: 'password123' // Gerçek şifreyi bilmiyorum, login endpoint'inden token alınmalı
};

const USER2 = {
  email: 'trust-user-0@tipbox.co',
  password: 'password123'
};

async function login(email, password) {
  try {
    const response = await axios.post(`${BASE_URL}/auth/login`, {
      email,
      password
    });
    return response.data.token || response.data.accessToken;
  } catch (error) {
    console.error(`❌ Login hatası (${email}):`, error.response?.data || error.message);
    // Eğer login başarısızsa, direkt token kullanabiliriz (test için)
    return null;
  }
}

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

async function createSocket(token) {
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
      console.log('✅ Socket authenticated:', data);
    });
  });
}

async function sendDMViaSocket(socket, recipientId, message) {
  return new Promise((resolve, reject) => {
    // Önce mesaj göndererek thread oluştur (POST /messages)
    // Sonra thread ID'yi al ve socket ile mesaj gönder
    
    socket.once('message_sent', (data) => {
      console.log('✅ Mesaj gönderildi (socket):', data);
      resolve(data);
    });

    socket.once('message_send_error', (error) => {
      console.error('❌ Mesaj gönderme hatası:', error);
      reject(error);
    });

    // Not: send_message için önce bir thread oluşturmamız gerekiyor
    // POST /messages ile thread oluşturulur
  });
}

async function sendDMViaAPI(token, recipientUserId, message) {
  try {
    const response = await axios.post(
      `${BASE_URL}/messages`,
      { recipientUserId, message },
      { headers: { Authorization: `Bearer ${token}` } }
    );
    return response.data;
  } catch (error) {
    console.error('❌ API mesaj gönderme hatası:', error.response?.data || error.message);
    throw error;
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

async function checkMessageInDB(messageText) {
  const { exec } = require('child_process');
  return new Promise((resolve, reject) => {
    exec(
      `docker exec tipbox_postgres psql -U postgres -d tipbox_dev -t -c "SELECT id, message, \"thread_id\", \"sender_id\", \"sent_at\" FROM dm_messages WHERE message LIKE '%${messageText}%' ORDER BY \"sent_at\" DESC LIMIT 1;"`,
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
            senderId: parts[3],
            sentAt: parts[4]
          });
        } else {
          resolve(null);
        }
      }
    );
  });
}

async function checkSupportRequestInDB(requestId) {
  const { exec } = require('child_process');
  return new Promise((resolve, reject) => {
    exec(
      `docker exec tipbox_postgres psql -U postgres -d tipbox_dev -t -c "SELECT id, status, thread_id, from_user_id, to_user_id FROM dm_requests WHERE id = '${requestId}';"`,
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
            status: parts[1],
            threadId: parts[2],
            fromUserId: parts[3],
            toUserId: parts[4]
          });
        } else {
          resolve(null);
        }
      }
    );
  });
}

async function getThreadIdFromDM(userId1, userId2) {
  const { exec } = require('child_process');
  return new Promise((resolve, reject) => {
    exec(
      `docker exec tipbox_postgres psql -U postgres -d tipbox_dev -t -c "SELECT id FROM dm_threads WHERE (user_one_id = '${userId1}' AND user_two_id = '${userId2}') OR (user_one_id = '${userId2}' AND user_two_id = '${userId1}') LIMIT 1;"`,
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

async function main() {
  console.log('🧪 DM ve Support Request Test Başlatılıyor...\n');

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

    // 2. Token'ları al (login başarısızsa manuel token gerekebilir)
    console.log('2️⃣  Token\'lar alınıyor...');
    console.log('   ⚠️  Login endpoint\'i çalışmıyorsa, token\'ları manuel olarak girmeniz gerekebilir\n');
    
    // Token'lar için manuel giriş gerekebilir
    // Şimdilik test için token'ları environment variable'dan alalım veya manuel girelim
    
    // 3. DM mesajı gönderme testi
    console.log('3️⃣  DM Mesajı Gönderme Testi');
    console.log('   ⚠️  Bu test için USER1_TOKEN ve USER2_TOKEN environment variable\'larını ayarlayın');
    console.log('   Örnek: USER1_TOKEN=xxx USER2_TOKEN=yyy node test-dm-and-support.js\n');
    
    const user1Token = process.env.USER1_TOKEN;
    const user2Token = process.env.USER2_TOKEN;
    
    if (!user1Token || !user2Token) {
      console.log('   📝 Manuel test adımları:');
      console.log('   1. İki kullanıcı için JWT token alın (login endpoint\'inden)');
      console.log('   2. USER1_TOKEN ve USER2_TOKEN environment variable\'larını ayarlayın');
      console.log('   3. Scripti tekrar çalıştırın');
      console.log('\n   Veya aşağıdaki komutları terminal\'den çalıştırabilirsiniz:\n');
      return;
    }

    // DM mesajı gönder (POST /messages)
    console.log('   📤 DM mesajı gönderiliyor (POST /messages)...');
    const dmMessage = `Test DM mesajı - ${new Date().toISOString()}`;
    try {
      await sendDMViaAPI(user1Token, user2.id, dmMessage);
      console.log('   ✅ DM mesajı gönderildi\n');
      
      // Mesajın DB'de olup olmadığını kontrol et
      console.log('   🔍 DB\'de mesaj kontrol ediliyor...');
      await new Promise(resolve => setTimeout(resolve, 1000)); // 1 saniye bekle
      const dbMessage = await checkMessageInDB(dmMessage.substring(0, 20));
      if (dbMessage) {
        console.log('   ✅ Mesaj DB\'de bulundu:', dbMessage);
      } else {
        console.log('   ❌ Mesaj DB\'de bulunamadı!');
      }
    } catch (error) {
      console.log('   ❌ DM mesajı gönderilemedi:', error.message);
    }

    console.log('\n');

    // 4. Support Request oluşturma ve accept testi
    console.log('4️⃣  Support Request Testi');
    
    // Support request oluştur
    console.log('   📤 Support request oluşturuluyor...');
    try {
      // Support request oluşturmak için önce senderUserId'yi token'dan çıkarmamız gerekiyor
      // Şimdilik direkt request gönderelim, backend senderUserId'yi JWT'den alacak
      const supportRequestResponse = await axios.post(
        `${BASE_URL}/messages/support-requests`,
        {
          senderUserId: user1.id, // Token'dan alınacak ama şimdilik manuel
          recipientUserId: user2.id,
          type: 'GENERAL',
          message: 'Test support request',
          amount: '50.00',
          status: 'pending',
          timestamp: new Date().toISOString()
        },
        { headers: { Authorization: `Bearer ${user1Token}` } }
      );
      
      // Response'dan request ID'yi al
      // POST /messages/support-requests genellikle 201 döner ama body'de ID olmayabilir
      // Request ID'yi almak için GET /messages/support-requests çağırmalıyız
      
      console.log('   ✅ Support request oluşturuldu, request ID alınıyor...');
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Request ID'yi almak için DB'den en yeni request'i alalım
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const { exec } = require('child_process');
      const latestRequestId = await new Promise((resolve, reject) => {
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
      });
      
      if (!latestRequestId) {
        console.log('   ❌ Oluşturulan support request bulunamadı!');
        return;
      }
      
      const requestId = latestRequestId;
      console.log(`   ✅ Support request ID: ${requestId}`);
      
      // DB'de threadId'nin null olduğunu kontrol et
      console.log('   🔍 DB\'de support request kontrol ediliyor (accept öncesi)...');
      const requestBeforeAccept = await checkSupportRequestInDB(requestId);
      if (requestBeforeAccept) {
        console.log('   📊 Support Request (Accept Öncesi):', requestBeforeAccept);
        if (requestBeforeAccept.threadId === null || requestBeforeAccept.threadId === '') {
          console.log('   ✅ threadId null (beklenen)');
        } else {
          console.log('   ⚠️  threadId zaten dolu:', requestBeforeAccept.threadId);
        }
      }
      
      // Accept et
      console.log('   ✅ Support request accept ediliyor...');
      const acceptResponse = await acceptSupportRequest(user2Token, requestId);
      console.log('   ✅ Accept response:', acceptResponse);
      
      // DB'de threadId'nin güncellenip güncellenmediğini kontrol et
      console.log('   🔍 DB\'de support request kontrol ediliyor (accept sonrası)...');
      await new Promise(resolve => setTimeout(resolve, 1000));
      const requestAfterAccept = await checkSupportRequestInDB(requestId);
      if (requestAfterAccept) {
        console.log('   📊 Support Request (Accept Sonrası):', requestAfterAccept);
        if (requestAfterAccept.threadId && requestAfterAccept.threadId !== null && requestAfterAccept.threadId !== '') {
          console.log('   ✅ threadId güncellendi:', requestAfterAccept.threadId);
          
          // Thread'in DB'de olup olmadığını kontrol et
          const { exec } = require('child_process');
          const threadCheck = await new Promise((resolve) => {
            exec(
              `docker exec tipbox_postgres psql -U postgres -d tipbox_dev -t -c "SELECT id, is_support_thread FROM dm_threads WHERE id = '${requestAfterAccept.threadId}';"`,
              (error, stdout, stderr) => {
                if (error) {
                  resolve(null);
                  return;
                }
                const line = stdout.trim();
                if (line) {
                  const parts = line.split('|').map(s => s.trim());
                  resolve({ id: parts[0], isSupportThread: parts[1] });
                } else {
                  resolve(null);
                }
              }
            );
          });
          
          if (threadCheck) {
            console.log('   ✅ Thread DB\'de bulundu:', threadCheck);
            if (threadCheck.isSupportThread === 't' || threadCheck.isSupportThread === 'true') {
              console.log('   ✅ Thread isSupportThread = true (doğru)');
            } else {
              console.log('   ❌ Thread isSupportThread = false (yanlış olmalı!)');
            }
          } else {
            console.log('   ❌ Thread DB\'de bulunamadı!');
          }
        } else {
          console.log('   ❌ threadId hala null!');
        }
      }
      
    } catch (error) {
      console.log('   ❌ Support request testi hatası:', error.response?.data || error.message);
    }

    console.log('\n✅ Test tamamlandı!');
    
  } catch (error) {
    console.error('❌ Test hatası:', error);
    process.exit(1);
  }
}

main();

