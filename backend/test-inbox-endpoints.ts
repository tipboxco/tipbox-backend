import axios from 'axios';

const BASE_URL = 'http://localhost:3000';
const EMAIL = 'omer@tipbox.co';
const PASSWORD = 'password123';

interface TestResult {
  name: string;
  success: boolean;
  message: string;
  data?: any;
}

async function login(): Promise<{ token: string; userId: string }> {
  console.log('\n[1/11] Login...');
  const response = await axios.post(`${BASE_URL}/auth/login`, {
    email: EMAIL,
    password: PASSWORD,
  });
  
  const token = response.data.token;
  const userId = response.data.id;
  console.log(`✓ Login başarılı - User ID: ${userId}`);
  return { token, userId };
}

async function testEndpoint(
  name: string,
  method: 'get' | 'post' | 'put' | 'delete',
  url: string,
  token: string,
  data?: any
): Promise<TestResult> {
  try {
    const config = {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    };

    let response;
    if (method === 'get') {
      response = await axios.get(url, config);
    } else if (method === 'post') {
      response = await axios.post(url, data, config);
    } else if (method === 'put') {
      response = await axios.put(url, data, config);
    } else {
      response = await axios.delete(url, config);
    }

    return {
      name,
      success: true,
      message: `Status: ${response.status}`,
      data: response.data,
    };
  } catch (error: any) {
    return {
      name,
      success: false,
      message: error.response?.data?.message || error.message || 'Unknown error',
      data: error.response?.data,
    };
  }
}

async function runTests() {
  console.log('========================================');
  console.log('Inbox Endpoints Test');
  console.log('========================================');

  // Login
  const { token, userId: currentUserId } = await login();
  const results: TestResult[] = [];

  // Test endpoints
  console.log('\n[2/11] GET /inbox - Inbox Listesi...');
  const inboxResult = await testEndpoint('GET /inbox', 'get', `${BASE_URL}/inbox`, token);
  results.push(inboxResult);
  if (inboxResult.success) {
    const count = Array.isArray(inboxResult.data) ? inboxResult.data.length : 0;
    console.log(`✓ Başarılı - Thread sayısı: ${count}`);
  } else {
    console.log(`✗ Hata: ${inboxResult.message}`);
  }

  console.log('\n[3/11] GET /inbox/feed...');
  const feedResult = await testEndpoint('GET /inbox/feed', 'get', `${BASE_URL}/inbox/feed`, token);
  results.push(feedResult);
  if (feedResult.success) {
    const count = Array.isArray(feedResult.data) ? feedResult.data.length : 0;
    console.log(`✓ Başarılı - Item sayısı: ${count}`);
  } else {
    console.log(`✗ Hata: ${feedResult.message}`);
  }

  console.log('\n[4/11] GET /inbox/support-requests...');
  const supportRequestsResult = await testEndpoint(
    'GET /inbox/support-requests',
    'get',
    `${BASE_URL}/inbox/support-requests`,
    token
  );
  results.push(supportRequestsResult);
  if (supportRequestsResult.success) {
    const count = Array.isArray(supportRequestsResult.data) ? supportRequestsResult.data.length : 0;
    console.log(`✓ Başarılı - Request sayısı: ${count}`);
  } else {
    console.log(`✗ Hata: ${supportRequestsResult.message}`);
  }

  console.log('\n[5/11] GET /inbox?search=test...');
  const searchResult = await testEndpoint('GET /inbox?search=test', 'get', `${BASE_URL}/inbox?search=test`, token);
  results.push(searchResult);
  if (searchResult.success) {
    const count = Array.isArray(searchResult.data) ? searchResult.data.length : 0;
    console.log(`✓ Başarılı - Sonuç sayısı: ${count}`);
  } else {
    console.log(`✗ Hata: ${searchResult.message}`);
  }

  console.log('\n[6/11] GET /inbox?unreadOnly=true...');
  const unreadResult = await testEndpoint(
    'GET /inbox?unreadOnly=true',
    'get',
    `${BASE_URL}/inbox?unreadOnly=true`,
    token
  );
  results.push(unreadResult);
  if (unreadResult.success) {
    const count = Array.isArray(unreadResult.data) ? unreadResult.data.length : 0;
    console.log(`✓ Başarılı - Thread sayısı: ${count}`);
  } else {
    console.log(`✗ Hata: ${unreadResult.message}`);
  }

  console.log('\n[7/11] GET /inbox?limit=10...');
  const limitResult = await testEndpoint('GET /inbox?limit=10', 'get', `${BASE_URL}/inbox?limit=10`, token);
  results.push(limitResult);
  if (limitResult.success) {
    const count = Array.isArray(limitResult.data) ? limitResult.data.length : 0;
    console.log(`✓ Başarılı - Thread sayısı: ${count}`);
  } else {
    console.log(`✗ Hata: ${limitResult.message}`);
  }

  console.log('\n[8/11] GET /inbox/support-requests?status=pending...');
  const statusResult = await testEndpoint(
    'GET /inbox/support-requests?status=pending',
    'get',
    `${BASE_URL}/inbox/support-requests?status=pending`,
    token
  );
  results.push(statusResult);
  if (statusResult.success) {
    const count = Array.isArray(statusResult.data) ? statusResult.data.length : 0;
    console.log(`✓ Başarılı - Request sayısı: ${count}`);
  } else {
    console.log(`✗ Hata: ${statusResult.message}`);
  }

  console.log('\n[9/11] GET /inbox/feed?limit=20...');
  const feedLimitResult = await testEndpoint(
    'GET /inbox/feed?limit=20',
    'get',
    `${BASE_URL}/inbox/feed?limit=20`,
    token
  );
  results.push(feedLimitResult);
  if (feedLimitResult.success) {
    const count = Array.isArray(feedLimitResult.data) ? feedLimitResult.data.length : 0;
    console.log(`✓ Başarılı - Item sayısı: ${count}`);
  } else {
    console.log(`✗ Hata: ${feedLimitResult.message}`);
  }

  // Thread mesajları testi (eğer thread varsa)
  console.log('\n[10/11] GET /inbox/:threadId...');
  if (inboxResult.success && Array.isArray(inboxResult.data) && inboxResult.data.length > 0) {
    const threadId = inboxResult.data[0].id;
    const threadMessagesResult = await testEndpoint(
      'GET /inbox/:threadId',
      'get',
      `${BASE_URL}/inbox/${threadId}`,
      token
    );
    results.push(threadMessagesResult);
    if (threadMessagesResult.success) {
      const count = Array.isArray(threadMessagesResult.data) ? threadMessagesResult.data.length : 0;
      console.log(`✓ Başarılı - Mesaj sayısı: ${count}`);
    } else {
      console.log(`✗ Hata: ${threadMessagesResult.message}`);
    }
  } else {
    console.log('⚠ Thread bulunamadı (atlanıyor)');
    results.push({
      name: 'GET /messages/:threadId',
      success: false,
      message: 'No thread available',
    });
  }

  // Julia Havk kullanıcısını bul
  console.log('\n[11/15] Julia Havk kullanıcısı aranıyor...');
  const JULIA_USER_ID = '99999999-9999-4999-9999-999999999999';
  const JULIA_EMAIL = 'julia.havk@tipbox.co';
  
  // Search endpoint ile Julia'yı bul
  let juliaUserId: string | null = null;
  try {
    const searchResult = await testEndpoint(
      'GET /search?keyword=julia',
      'get',
      `${BASE_URL}/search?keyword=julia&types=user&limit=10`,
      token
    );
    
    if (searchResult.success && searchResult.data?.userData) {
      const juliaUser = searchResult.data.userData.find((u: any) => 
        u.email === JULIA_EMAIL || u.id === JULIA_USER_ID || u.name?.toLowerCase().includes('julia')
      );
      
      if (juliaUser) {
        juliaUserId = juliaUser.id;
        console.log(`✓ Julia Havk bulundu - User ID: ${juliaUserId}`);
      } else {
        // Direkt ID ile dene
        juliaUserId = JULIA_USER_ID;
        console.log(`⚠ Search'te bulunamadı, direkt ID kullanılıyor: ${juliaUserId}`);
      }
    } else {
      juliaUserId = JULIA_USER_ID;
      console.log(`⚠ Search başarısız, direkt ID kullanılıyor: ${juliaUserId}`);
    }
  } catch (error) {
    juliaUserId = JULIA_USER_ID;
    console.log(`⚠ Hata, direkt ID kullanılıyor: ${juliaUserId}`);
  }

  // POST endpoint testleri
  if (juliaUserId) {
    console.log('\n[12/15] POST /inbox/threads - Thread Oluştur...');
    const threadResult = await testEndpoint(
      'POST /inbox/threads',
      'post',
      `${BASE_URL}/inbox/threads`,
      token,
      { recipientId: juliaUserId }
    );
    results.push(threadResult);
    if (threadResult.success) {
      console.log(`✓ Başarılı - Thread ID: ${threadResult.data?.id || 'N/A'}`);
    } else {
      console.log(`✗ Hata: ${threadResult.message}`);
    }

    console.log('\n[13/15] POST /inbox - Direkt Mesaj Gönder...');
    const messageResult = await testEndpoint(
      'POST /inbox',
      'post',
      `${BASE_URL}/inbox`,
      token,
      {
        recipientUserId: juliaUserId,
        message: 'Test mesajı - Inbox endpoint testi'
      }
    );
    results.push(messageResult);
    if (messageResult.success) {
      console.log(`✓ Başarılı - Mesaj gönderildi`);
    } else {
      console.log(`✗ Hata: ${messageResult.message}`);
    }

    console.log('\n[14/15] POST /inbox/support-requests - Support Request Oluştur...');
    const supportRequestResult = await testEndpoint(
      'POST /inbox/support-requests',
      'post',
      `${BASE_URL}/inbox/support-requests`,
      token,
      {
        senderUserId: currentUserId,
        recipientUserId: juliaUserId,
        type: 'GENERAL',
        message: 'Test support request - Inbox endpoint testi',
        amount: '50.00',
        status: 'pending',
        timestamp: new Date().toISOString()
      }
    );
    results.push(supportRequestResult);
    if (supportRequestResult.success) {
      console.log(`✓ Başarılı - Support request oluşturuldu`);
    } else {
      console.log(`✗ Hata: ${supportRequestResult.message}`);
    }

    console.log('\n[15/15] POST /inbox/tips - TIPS Gönder...');
    const tipsResult = await testEndpoint(
      'POST /inbox/tips',
      'post',
      `${BASE_URL}/inbox/tips`,
      token,
      {
        senderUserId: currentUserId,
        recipientUserId: juliaUserId,
        message: 'Test TIPS - Inbox endpoint testi',
        amount: 10.50,
        timestamp: new Date().toISOString()
      }
    );
    results.push(tipsResult);
    if (tipsResult.success) {
      console.log(`✓ Başarılı - TIPS gönderildi`);
    } else {
      console.log(`✗ Hata: ${tipsResult.message}`);
    }
  } else {
    console.log('\n⚠ Julia Havk kullanıcısı bulunamadı, POST testleri atlanıyor');
  }

  // Özet
  console.log('\n========================================');
  console.log('Test Özeti');
  console.log('========================================');
  const successCount = results.filter((r) => r.success).length;
  const failCount = results.filter((r) => !r.success).length;
  console.log(`Toplam GET Testi: ${results.length}`);
  console.log(`✓ Başarılı: ${successCount}`);
  console.log(`✗ Başarısız: ${failCount}`);
  console.log('========================================\n');

  // Başarısız testleri göster
  if (failCount > 0) {
    console.log('Başarısız Testler:');
    results.filter((r) => !r.success).forEach((r) => {
      console.log(`  - ${r.name}: ${r.message}`);
    });
    console.log('');
  }

  console.log('Not: POST endpoint\'leri test etmek için recipientId gerekli.');
  console.log('     Bu testler manuel olarak veya e2e test suite ile yapılabilir.\n');
}

runTests().catch((error) => {
  console.error('Test hatası:', error);
  process.exit(1);
});

