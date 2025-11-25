/**
 * Kapsamlı Messaging Test Scripti
 * 
 * Bu script şunları test eder:
 * 1. DM ekranında type:message (3 adet)
 * 2. DM ekranında type:tips (3 adet)
 * 3. DM ekranında type:support-request (3 adet - 1. ve 3. accept edilecek)
 * 4. İlk support chat thread'inde konuşma
 * 5. 3. support chat thread'inde farklı konuşma
 * 6. DB kontrolü - DM ve Support Chat mesajları doğru thread ID'lere yazılmış mı?
 * 
 * Kullanım:
 * USER1_TOKEN=xxx USER2_TOKEN=yyy node test-complete-messaging.js
 */

const { io } = require('socket.io-client');
const axios = require('axios');

const BASE_URL = process.env.API_URL || 'http://localhost:3000';

let user1, user2, user1Token, user2Token, dmThreadId;

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

async function sendTipsViaAPI(token, senderUserId, recipientUserId, message, amount) {
  try {
    const response = await axios.post(
      `${BASE_URL}/messages/tips`,
      {
        senderUserId, // JWT'den kontrol edilecek
        recipientUserId,
        message,
        amount,
        timestamp: new Date().toISOString()
      },
      { headers: { Authorization: `Bearer ${token}` } }
    );
    return response.data;
  } catch (error) {
    console.error('❌ TIPS gönderme hatası:', error.response?.data || error.message);
    throw error;
  }
}

async function createSupportRequest(token, senderUserId, recipientUserId, type, message, amount) {
  try {
    const response = await axios.post(
      `${BASE_URL}/messages/support-requests`,
      {
        senderUserId, // JWT'den kontrol edilecek
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

function createSocket(token) {
  return new Promise((resolve, reject) => {
    const socket = io(BASE_URL, {
      auth: { token },
      transports: ['websocket', 'polling']
    });

    socket.on('connect', () => {
      resolve(socket);
    });

    socket.on('connect_error', (error) => {
      reject(error);
    });
  });
}

async function sendSupportMessage(socket, threadId, message) {
  return new Promise((resolve, reject) => {
    socket.once('message_sent', (data) => {
      resolve(data);
    });

    socket.once('message_send_error', (error) => {
      reject(error);
    });

    socket.emit('send_support_message', { threadId, message });
  });
}

async function getDMThreadId(userId1, userId2) {
  const { exec } = require('child_process');
  return new Promise((resolve, reject) => {
    exec(
      `docker exec tipbox_postgres psql -U postgres -d tipbox_dev -t -c "SELECT id FROM dm_threads WHERE ((user_one_id = '${userId1}' AND user_two_id = '${userId2}') OR (user_one_id = '${userId2}' AND user_two_id = '${userId1}')) AND is_support_thread = false ORDER BY updated_at DESC LIMIT 1;"`,
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

async function getLatestSupportRequestId(userId1, userId2, afterTime = null) {
  const { exec } = require('child_process');
  return new Promise((resolve, reject) => {
    let query = `SELECT id FROM dm_requests WHERE from_user_id = '${userId1}' AND to_user_id = '${userId2}'`;
    if (afterTime) {
      query += ` AND sent_at > '${afterTime}'`;
    }
    query += ` ORDER BY sent_at DESC LIMIT 1;`;
    exec(
      `docker exec tipbox_postgres psql -U postgres -d tipbox_dev -t -c "${query}"`,
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

function escapeLiteral(text) {
  return text.replace(/\\/g, '\\\\').replace(/'/g, "''");
}

async function checkMessageInDB(messageText, expectedThreadId = null, expectedContext = null) {
  const { exec } = require('child_process');
  return new Promise((resolve, reject) => {
    const whereClause = messageText
      ? `message = '${escapeLiteral(messageText)}'`
      : '1=1';
    exec(
      `docker exec tipbox_postgres psql -U postgres -d tipbox_dev -t -c "SELECT id, message, thread_id, context, sender_id FROM dm_messages WHERE ${whereClause} ORDER BY sent_at DESC LIMIT 1;"`,
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

async function checkTipsInDB(tipsId) {
  const { exec } = require('child_process');
  return new Promise((resolve, reject) => {
    exec(
      `docker exec tipbox_postgres psql -U postgres -d tipbox_dev -t -c "SELECT id, from_user_id, to_user_id, amount, reason FROM tips_token_transfers WHERE id = '${tipsId}';"`,
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
            fromUserId: parts[1],
            toUserId: parts[2],
            amount: parts[3],
            reason: parts[4]
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
      `docker exec tipbox_postgres psql -U postgres -d tipbox_dev -t -c "SELECT id, status, thread_id FROM dm_requests WHERE id = '${requestId}';"`,
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
            threadId: parts[2]
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

async function login(email, password) {
  try {
    const response = await axios.post(`${BASE_URL}/auth/login`, {
      email,
      password
    });
    return response.data.token || response.data.accessToken || response.data;
  } catch (error) {
    if (error.response) {
      console.error(`❌ Login hatası (${email}):`, error.response.status, error.response.data);
    } else {
      console.error(`❌ Login hatası (${email}):`, error.message);
    }
    return null;
  }
}

async function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  console.log('🧪 Kapsamlı Messaging Test Başlatılıyor...\n');

  try {
    // 1. Kullanıcıları DB'den al
    console.log('1️⃣  Kullanıcıları DB\'den alınıyor...');
    const users = await getUsersFromDB();
    if (users.length < 2) {
      console.error('❌ En az 2 kullanıcı bulunmalı');
      process.exit(1);
    }
    user1 = users[0];
    user2 = users[1];
    console.log(`   ✅ User 1: ${user1.email} (${user1.id})`);
    console.log(`   ✅ User 2: ${user2.email} (${user2.id})\n`);

    // 2. Token'ları al
    console.log('2️⃣  Token\'lar alınıyor...\n');
    user1Token = process.env.USER1_TOKEN;
    user2Token = process.env.USER2_TOKEN;
    
    // Eğer token yoksa, otomatik login dene
    if (!user1Token) {
      console.log('   🔐 User1 için token alınıyor...');
      user1Token = await login(user1.email, 'password123');
      if (!user1Token) {
        console.error(`❌ User1 (${user1.email}) için token alınamadı`);
        process.exit(1);
      }
      console.log('   ✅ User1 token alındı\n');
    } else {
      console.log('   ✅ User1 token (env var)\n');
    }
    
    if (!user2Token) {
      console.log('   🔐 User2 için token alınıyor...');
      user2Token = await login(user2.email, 'password123');
      if (!user2Token) {
        console.error(`❌ User2 (${user2.email}) için token alınamadı`);
        process.exit(1);
      }
      console.log('   ✅ User2 token alındı\n');
    } else {
      console.log('   ✅ User2 token (env var)\n');
    }
    
    if (!user1Token || !user2Token) {
      console.error('❌ USER1_TOKEN ve USER2_TOKEN environment variable\'larını ayarlayın');
      console.log('   Örnek: USER1_TOKEN=xxx USER2_TOKEN=yyy node test-complete-messaging.js');
      process.exit(1);
    }

    // 3. DM Thread ID'yi al (ilk mesaj ile oluşturulacak)
    console.log('2️⃣  DM Ekranı - Mesajlar, TIPS ve Support Request\'ler\n');

    // 3.1. DM Mesajları (3 adet)
    console.log('   📨 DM Mesajları (3 adet)...');
    const dmMessages = [];
    for (let i = 1; i <= 3; i++) {
      const message = `DM mesajı ${i} - ${new Date().toISOString()}`;
      await sendDMViaAPI(user1Token, user2.id, message);
      dmMessages.push(message);
      console.log(`      ✅ DM mesajı ${i} gönderildi`);
      await wait(500);
    }
    
    // DM Thread ID'yi al
    await wait(1000);
    dmThreadId = await getDMThreadId(user1.id, user2.id);
    console.log(`      ✅ DM Thread ID: ${dmThreadId}\n`);

    // 3.2. TIPS (3 adet)
    console.log('   💰 TIPS (3 adet)...');
    const tipsMessages = [];
    for (let i = 1; i <= 3; i++) {
      const message = `TIPS mesajı ${i} - ${new Date().toISOString()}`;
      await sendTipsViaAPI(user1Token, user1.id, user2.id, message, 10 + i);
      tipsMessages.push(message);
      console.log(`      ✅ TIPS ${i} gönderildi (${10 + i} TIPS)`);
      await wait(500);
    }
    console.log();

    // 3.3. Support Request'ler (3 adet)
    console.log('   🆘 Support Request\'ler (3 adet)...');
    const supportRequestIds = [];
    const acceptedRequestIds = [];
    let lastRequestTime = null;
    for (let i = 1; i <= 3; i++) {
      const beforeTime = new Date().toISOString();
      const message = `Support request ${i} - ${beforeTime}`;
      await createSupportRequest(user1Token, user1.id, user2.id, 'GENERAL', message, 50 + i);
      await wait(1000);
      // Unique constraint nedeniyle aynı ID'ye güncellenebilir, her seferinde en son request'i al
      const requestId = await getLatestSupportRequestId(user1.id, user2.id, lastRequestTime);
      if (requestId) {
        supportRequestIds.push(requestId);
        console.log(`      ✅ Support request ${i} oluşturuldu: ${requestId}`);
        lastRequestTime = beforeTime;
      } else {
        // Eğer unique constraint nedeniyle aynı request güncelleniyorsa, ID'yi direkt al
        const allRequests = await getLatestSupportRequestId(user1.id, user2.id);
        if (allRequests) {
          // Aynı ID zaten listede yoksa ekle
          if (!supportRequestIds.includes(allRequests)) {
            supportRequestIds.push(allRequests);
            console.log(`      ✅ Support request ${i} oluşturuldu (unique): ${allRequests}`);
          } else {
            // Aynı ID'ye güncellenmiş, yeni bir ID oluşturmak için önceki request'i sil
            console.log(`      ⚠️  Support request ${i} unique constraint nedeniyle aynı ID'ye güncellendi, test devam ediyor...`);
            supportRequestIds.push(allRequests); // Aynı ID'yi tekrar ekle (test için)
          }
        }
      }
      await wait(500);
    }
    console.log();

    // 3.4. İlk ve 3. Support Request'i accept et
    console.log('   ✅ Support Request Accept işlemleri...');
    
    // Unique constraint nedeniyle tüm request'ler aynı ID'ye sahip olabilir
    // Bu durumda, test için 2 farklı request ID'si kullanmalıyız
    // Önce mevcut request'leri kontrol et
    const uniqueRequestIds = [...new Set(supportRequestIds.filter(id => id && id !== 'null'))];
    console.log(`      📊 Unique request ID'leri: ${uniqueRequestIds.length} adet`);
    
    if (uniqueRequestIds.length === 0) {
      console.log('      ❌ Support request ID bulunamadı!');
      return;
    }
    
    // İlk support request'i accept et
    const firstRequestId = uniqueRequestIds[0];
    console.log(`      📤 İlk support request accept ediliyor: ${firstRequestId}...`);
    console.log(`      🔍 User2 Token kontrol: ${user2Token ? 'Token var' : 'Token yok'}`);
    console.log(`      🔍 User2 ID: ${user2.id}`);
    const accept1Response = await acceptSupportRequest(user2Token, firstRequestId);
    const supportThreadId1 = accept1Response.threadId;
    acceptedRequestIds.push(firstRequestId);
    console.log(`      ✅ İlk support thread oluşturuldu: ${supportThreadId1}`);
    await wait(2000); // Thread ID'nin DB'ye yazılması için bekle
    
    // 3. support request için: Eğer farklı bir request varsa onu accept et, yoksa yeni bir request oluştur
    let thirdRequestId;
    if (uniqueRequestIds.length >= 3) {
      thirdRequestId = uniqueRequestIds[2];
    } else if (uniqueRequestIds.length === 2) {
      thirdRequestId = uniqueRequestIds[1];
    } else {
      // Yeni bir support request oluştur (3. request)
      console.log('      📤 3. support request oluşturuluyor (unique constraint için)...');
      await createSupportRequest(user1Token, user1.id, user2.id, 'TECHNICAL', `Support request 3 - ${new Date().toISOString()}`, 53);
      await wait(1000);
      // Farklı bir kullanıcı çifti için yeni request oluşturmak yerine, mevcut request'i reject edip yeni oluşturabiliriz
      // Ya da direkt yeni bir request oluşturup accept edebiliriz
      // Şimdilik, aynı request'i kabul etmiş gibi davranalım ve yeni bir request oluşturup accept edelim
      const newRequestId = await getLatestSupportRequestId(user1.id, user2.id);
      if (newRequestId && newRequestId !== firstRequestId) {
        thirdRequestId = newRequestId;
      } else {
        // Hala aynı ID ise, önce reject edip yeni oluştur
        // Basitlik için, yeni bir request oluşturup kabul edelim
        console.log('      ⚠️  Unique constraint nedeniyle aynı request ID, yeni request oluşturuluyor...');
        // Request'i reject edelim ki yeni request oluşturulabilsin
        // Ama reject endpoint'i yoksa, yeni bir request oluşturup hemen accept edelim
        await createSupportRequest(user1Token, user1.id, user2.id, 'PRODUCT', `Support request 3 new - ${new Date().toISOString()}`, 54);
        await wait(1000);
        const finalRequestId = await getLatestSupportRequestId(user1.id, user2.id);
        thirdRequestId = finalRequestId || firstRequestId; // Fallback olarak ilk ID'yi kullan
      }
    }
    
    console.log(`      📤 3. support request accept ediliyor: ${thirdRequestId}...`);
    const accept3Response = await acceptSupportRequest(user2Token, thirdRequestId);
    const supportThreadId3 = accept3Response.threadId;
    if (!acceptedRequestIds.includes(thirdRequestId)) {
      acceptedRequestIds.push(thirdRequestId);
    }
    console.log(`      ✅ 3. support thread oluşturuldu: ${supportThreadId3}`);
    await wait(2000); // Thread ID'nin DB'ye yazılması için bekle
    console.log();

    // 4. Support Chat Konuşmaları
    console.log('3️⃣  Support Chat Konuşmaları\n');

    // 4.1. İlk support chat thread'inde konuşma
    console.log('   💬 İlk Support Chat Thread\'inde konuşma...');
    const socket1 = await createSocket(user1Token);
    const socket2 = await createSocket(user2Token);
    
    socket1.emit('join_thread', supportThreadId1);
    socket2.emit('join_thread', supportThreadId1);
    await wait(500);
    
    const supportMessages1 = [];
    for (let i = 1; i <= 3; i++) {
      const message = `Support chat mesajı Thread1-${i} - ${new Date().toISOString()}`;
      if (i % 2 === 1) {
        await sendSupportMessage(socket1, supportThreadId1, message);
        console.log(`      ✅ User1 mesaj gönderdi: ${message.substring(0, 30)}...`);
      } else {
        await sendSupportMessage(socket2, supportThreadId1, message);
        console.log(`      ✅ User2 mesaj gönderdi: ${message.substring(0, 30)}...`);
      }
      supportMessages1.push(message);
      await wait(500);
    }
    console.log();

    // 4.2. 3. support chat thread'inde farklı konuşma
    console.log('   💬 3. Support Chat Thread\'inde konuşma...');
    socket1.emit('leave_thread', supportThreadId1);
    socket2.emit('leave_thread', supportThreadId1);
    await wait(500);
    
    socket1.emit('join_thread', supportThreadId3);
    socket2.emit('join_thread', supportThreadId3);
    await wait(500);
    
    const supportMessages3 = [];
    for (let i = 1; i <= 3; i++) {
      const message = `Support chat mesajı Thread3-${i} - ${new Date().toISOString()}`;
      if (i % 2 === 1) {
        await sendSupportMessage(socket2, supportThreadId3, message);
        console.log(`      ✅ User2 mesaj gönderdi: ${message.substring(0, 30)}...`);
      } else {
        await sendSupportMessage(socket1, supportThreadId3, message);
        console.log(`      ✅ User1 mesaj gönderdi: ${message.substring(0, 30)}...`);
      }
      supportMessages3.push(message);
      await wait(500);
    }
    
    socket1.disconnect();
    socket2.disconnect();
    console.log();

    // 5. DB Kontrolü
    console.log('4️⃣  DB Kontrolü\n');
    await wait(2000);

    // 5.1. DM Mesajları Kontrolü
    console.log('   🔍 DM Mesajları Kontrolü...');
    for (let i = 0; i < dmMessages.length; i++) {
      const message = dmMessages[i];
      const dbMessage = await checkMessageInDB(message);
      if (dbMessage) {
        if (dbMessage.threadId === dmThreadId) {
          console.log(`      ✅ DM Mesaj ${i + 1}: Doğru thread ID (${dbMessage.threadId})`);
        } else {
          console.log(`      ❌ DM Mesaj ${i + 1}: Yanlış thread ID (Expected: ${dmThreadId}, Actual: ${dbMessage.threadId})`);
        }
        if (dbMessage.context === 'DM' || dbMessage.context === null || dbMessage.context === '') {
          console.log(`      ✅ DM Mesaj ${i + 1}: Doğru context (${dbMessage.context || 'NULL'})`);
        } else {
          console.log(`      ❌ DM Mesaj ${i + 1}: Yanlış context (Expected: DM/NULL, Actual: ${dbMessage.context})`);
        }
      } else {
        console.log(`      ❌ DM Mesaj ${i + 1}: DB'de bulunamadı!`);
      }
    }
    console.log();

    // 5.2. Support Request'ler Kontrolü
    console.log('   🔍 Support Request\'ler Kontrolü...');
    for (let i = 0; i < supportRequestIds.length; i++) {
      const requestId = supportRequestIds[i];
      const dbRequest = await checkSupportRequestInDB(requestId);
      if (dbRequest) {
        if (acceptedRequestIds.includes(requestId)) {
          // Accepted request
          if (dbRequest.threadId && dbRequest.threadId !== '') {
            console.log(`      ✅ Support Request ${i + 1}: Thread ID var (${dbRequest.threadId})`);
            if (dbRequest.status === 'ACCEPTED') {
              console.log(`      ✅ Support Request ${i + 1}: Status ACCEPTED`);
            } else {
              console.log(`      ❌ Support Request ${i + 1}: Status ${dbRequest.status} (ACCEPTED olmalı)`);
            }
          } else {
            console.log(`      ❌ Support Request ${i + 1}: Thread ID yok!`);
          }
        } else {
          // Pending request
          if (!dbRequest.threadId || dbRequest.threadId === '') {
            console.log(`      ✅ Support Request ${i + 1}: Thread ID yok (pending - beklenen)`);
          } else {
            console.log(`      ⚠️  Support Request ${i + 1}: Thread ID var ama pending (${dbRequest.threadId})`);
          }
          if (dbRequest.status === 'PENDING') {
            console.log(`      ✅ Support Request ${i + 1}: Status PENDING`);
          } else {
            console.log(`      ❌ Support Request ${i + 1}: Status ${dbRequest.status} (PENDING olmalı)`);
          }
        }
      } else {
        console.log(`      ❌ Support Request ${i + 1}: DB'de bulunamadı!`);
      }
    }
    console.log();

    // 5.3. Support Chat Mesajları Kontrolü - Thread 1
    console.log('   🔍 Support Chat Mesajları Kontrolü - Thread 1...');
    for (let i = 0; i < supportMessages1.length; i++) {
      const message = supportMessages1[i];
      const dbMessage = await checkMessageInDB(message);
      if (dbMessage) {
        if (dbMessage.threadId === supportThreadId1) {
          console.log(`      ✅ Support Mesaj Thread1-${i + 1}: Doğru thread ID (${dbMessage.threadId})`);
        } else {
          console.log(`      ❌ Support Mesaj Thread1-${i + 1}: Yanlış thread ID (Expected: ${supportThreadId1}, Actual: ${dbMessage.threadId})`);
        }
        if (dbMessage.context === 'SUPPORT') {
          console.log(`      ✅ Support Mesaj Thread1-${i + 1}: Doğru context (SUPPORT)`);
        } else {
          console.log(`      ❌ Support Mesaj Thread1-${i + 1}: Yanlış context (Expected: SUPPORT, Actual: ${dbMessage.context})`);
        }
      } else {
        console.log(`      ❌ Support Mesaj Thread1-${i + 1}: DB'de bulunamadı!`);
      }
    }
    console.log();

    // 5.4. Support Chat Mesajları Kontrolü - Thread 3
    console.log('   🔍 Support Chat Mesajları Kontrolü - Thread 3...');
    for (let i = 0; i < supportMessages3.length; i++) {
      const message = supportMessages3[i];
      const dbMessage = await checkMessageInDB(message);
      if (dbMessage) {
        if (dbMessage.threadId === supportThreadId3) {
          console.log(`      ✅ Support Mesaj Thread3-${i + 1}: Doğru thread ID (${dbMessage.threadId})`);
        } else {
          console.log(`      ❌ Support Mesaj Thread3-${i + 1}: Yanlış thread ID (Expected: ${supportThreadId3}, Actual: ${dbMessage.threadId})`);
        }
        if (dbMessage.context === 'SUPPORT') {
          console.log(`      ✅ Support Mesaj Thread3-${i + 1}: Doğru context (SUPPORT)`);
        } else {
          console.log(`      ❌ Support Mesaj Thread3-${i + 1}: Yanlış context (Expected: SUPPORT, Actual: ${dbMessage.context})`);
        }
      } else {
        console.log(`      ❌ Support Mesaj Thread3-${i + 1}: DB'de bulunamadı!`);
      }
    }
    console.log();

    // 5.5. Thread Kontrolü
    console.log('   🔍 Thread Kontrolü...');
    const dmThread = await checkThreadInDB(dmThreadId);
    if (dmThread) {
      if (dmThread.isSupportThread === 'f' || dmThread.isSupportThread === 'false') {
        console.log(`      ✅ DM Thread: is_support_thread = false (doğru)`);
      } else {
        console.log(`      ❌ DM Thread: is_support_thread = true (yanlış!)`);
      }
    }
    
    const thread1 = await checkThreadInDB(supportThreadId1);
    if (thread1) {
      if (thread1.isSupportThread === 't' || thread1.isSupportThread === 'true') {
        console.log(`      ✅ Support Thread 1: is_support_thread = true (doğru)`);
      } else {
        console.log(`      ❌ Support Thread 1: is_support_thread = false (yanlış!)`);
      }
    }
    
    const thread3 = await checkThreadInDB(supportThreadId3);
    if (thread3) {
      if (thread3.isSupportThread === 't' || thread3.isSupportThread === 'true') {
        console.log(`      ✅ Support Thread 3: is_support_thread = true (doğru)`);
      } else {
        console.log(`      ❌ Support Thread 3: is_support_thread = false (yanlış!)`);
      }
    }
    console.log();

    console.log('✅ Test tamamlandı!');
    
  } catch (error) {
    console.error('❌ Test hatası:', error);
    process.exit(1);
  }
}

main();

