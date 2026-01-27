import axios, { AxiosInstance } from 'axios';
import * as readline from 'readline';

// Kullanıcı bilgileri
const TUNA_USER_ID = '7413549b-126e-4b41-a06b-c22600a85f67';
const TUNA_EMAIL = 'tuna@tipbox.co';
const GEORGIA_USER_ID = '480f5de9-b691-4d70-a6a8-2789226f4e07';
const GEORGIA_EMAIL = 'omer@tipbox.co';

const BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000';

// Readline interface
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function question(prompt: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

function log(message: string, type: 'info' | 'success' | 'error' | 'warning' = 'info') {
  const colors = {
    info: '\x1b[36m',    // Cyan
    success: '\x1b[32m', // Green
    error: '\x1b[31m',   // Red
    warning: '\x1b[33m',  // Yellow
    reset: '\x1b[0m',
  };
  const icons = {
    info: 'ℹ️',
    success: '✅',
    error: '❌',
    warning: '⚠️',
  };
  console.log(`${colors[type]}${icons[type]} ${message}${colors.reset}`);
}

/**
 * Kullanıcı girişi yap ve token al
 */
async function login(email: string): Promise<string | null> {
  try {
    log(`Giriş yapılıyor: ${email}...`, 'info');
    
    const DEFAULT_PASSWORD = 'password123';
    
    const response = await axios.post(`${BASE_URL}/auth/login`, {
      email,
      password: DEFAULT_PASSWORD,
    });

    if (response.data && response.data.token) {
      log(`Giriş başarılı: ${email}`, 'success');
      return response.data.token;
    }

    log(`Giriş başarısız: ${email}`, 'error');
    return null;
  } catch (error: any) {
    log(`Giriş hatası: ${error.response?.data?.message || error.message}`, 'error');
    return null;
  }
}

/**
 * API client oluştur
 */
function createApiClient(token: string): AxiosInstance {
  return axios.create({
    baseURL: BASE_URL,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });
}

/**
 * Adım 1: Tuna'dan Georgia'ya DM gönder
 */
async function step1_sendDM(api: AxiosInstance): Promise<boolean> {
  try {
    log('Adım 1: Tuna\'dan Georgia\'ya DM gönderiliyor...', 'info');
    
    const message = 'Merhaba Georgia, bir support request oluşturmak istiyorum.';
    
    const response = await api.post('/inbox', {
      recipientUserId: GEORGIA_USER_ID,
      message: message.trim(),
    });

    if (response.status === 201 || response.status === 200) {
      log(`DM başarıyla gönderildi!`, 'success');
      log(`Message ID: ${response.data.id || response.data.messageId || 'N/A'}`, 'info');
      return true;
    }
    
    return false;
  } catch (error: any) {
    log(`DM gönderme hatası: ${error.response?.data?.message || error.message}`, 'error');
    if (error.response?.data) {
      log(`Response: ${JSON.stringify(error.response.data, null, 2)}`, 'error');
    }
    return false;
  }
}

/**
 * Adım 2: Support Request oluştur
 */
async function step2_createSupportRequest(api: AxiosInstance): Promise<string | null> {
  try {
    log('Adım 2: Support Request oluşturuluyor...', 'info');
    
    const type = 'GENERAL';
    const message = 'Teknik bir desteğe ihtiyacım var';
    const amount = 4;

    const response = await api.post('/inbox/support-requests', {
      senderUserId: TUNA_USER_ID,
      recipientUserId: GEORGIA_USER_ID,
      type,
      message: message.trim(),
      amount: amount.toString(),
      status: 'pending',
      timestamp: new Date().toISOString(),
    });

    if (response.status === 201) {
      const requestId = response.data.id || response.data.requestId;
      log(`Support Request başarıyla oluşturuldu!`, 'success');
      log(`Request ID: ${requestId}`, 'info');
      log(`Status: ${response.data.status || 'pending'}`, 'info');
      return requestId;
    }
    
    return null;
  } catch (error: any) {
    log(`Support Request oluşturma hatası: ${error.response?.data?.message || error.message}`, 'error');
    if (error.response?.data) {
      log(`Response: ${JSON.stringify(error.response.data, null, 2)}`, 'error');
    }
    return null;
  }
}

/**
 * Adım 3: Support Request'in kabul edilmesini bekle
 */
async function step3_waitForAccept(
  api: AxiosInstance, 
  requestId: string, 
  maxWaitSeconds: number = 60
): Promise<boolean> {
  try {
    log(`Adım 3: Support Request'in kabul edilmesi bekleniyor (max ${maxWaitSeconds} saniye)...`, 'info');
    log(`Request ID: ${requestId}`, 'info');
    
    const startTime = Date.now();
    const checkInterval = 2000; // 2 saniyede bir kontrol et
    let attempts = 0;
    const maxAttempts = Math.ceil((maxWaitSeconds * 1000) / checkInterval);

    while (attempts < maxAttempts) {
      attempts++;
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      
      try {
        // Support request'leri listele ve request ID'yi bul
        const response = await api.get('/inbox/support-requests', {
          params: {
            limit: 100,
          },
        });

        if (response.data && response.data.items) {
          const request = response.data.items.find((req: any) => req.id === requestId);
          
          if (request) {
            log(`Request durumu: ${request.status} (${elapsed}s geçti)`, 'info');
            
            if (request.status === 'accepted' || request.status === 'active') {
              log(`Support Request kabul edildi!`, 'success');
              log(`Thread ID: ${request.threadId || 'N/A'}`, 'info');
              return true;
            }
            
            if (request.status === 'rejected') {
              log(`Support Request reddedildi!`, 'error');
              return false;
            }
          } else {
            log(`Request bulunamadı (${elapsed}s geçti)`, 'warning');
          }
        }
      } catch (error: any) {
        log(`Kontrol hatası: ${error.response?.data?.message || error.message}`, 'warning');
      }

      // Bekle
      await new Promise(resolve => setTimeout(resolve, checkInterval));
    }

    log(`Timeout: Support Request ${maxWaitSeconds} saniye içinde kabul edilmedi`, 'error');
    return false;
  } catch (error: any) {
    log(`Bekleme hatası: ${error.message}`, 'error');
    return false;
  }
}

/**
 * Ana test akışı
 */
async function main() {
  try {
    console.log('\n' + '═'.repeat(60));
    console.log('  Support Request Flow Test Script');
    console.log('═'.repeat(60));
    console.log('  Adımlar:');
    console.log('  1. Tuna\'dan Georgia\'ya DM gönder');
    console.log('  2. Support Request oluştur');
    console.log('  3. Georgia\'nın kabul etmesini bekle');
    console.log('═'.repeat(60) + '\n');

    // Tuna için login
    log('Tuna için giriş yapılıyor...', 'info');
    const tunaToken = await login(TUNA_EMAIL);
    if (!tunaToken) {
      log('Tuna girişi başarısız!', 'error');
      process.exit(1);
    }

    const tunaApi = createApiClient(tunaToken);

    // Adım 1: DM gönder
    const dmSuccess = await step1_sendDM(tunaApi);
    if (!dmSuccess) {
      log('DM gönderme başarısız!', 'error');
      process.exit(1);
    }

    // Kısa bir bekleme
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Adım 2: Support Request oluştur
    const requestId = await step2_createSupportRequest(tunaApi);
    if (!requestId) {
      log('Support Request oluşturma başarısız!', 'error');
      process.exit(1);
    }

    // Kısa bir bekleme
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Adım 3: Kabul edilmesini bekle
    log('\n⚠️  ŞİMDİ GEORGIA KULLANICISI MANUEL OLARAK REQUEST\'İ KABUL ETMELİ!', 'warning');
    log('Georgia için script çalıştırın veya manuel olarak kabul edin.\n', 'info');
    
    const accepted = await step3_waitForAccept(tunaApi, requestId, 120);
    
    if (accepted) {
      log('\n✅ TÜM ADIMLAR BAŞARIYLA TAMAMLANDI!', 'success');
      
      // Final durumu göster
      try {
        const response = await tunaApi.get('/inbox/support-requests', {
          params: { limit: 100 },
        });
        
        if (response.data && response.data.items) {
          const request = response.data.items.find((req: any) => req.id === requestId);
          if (request) {
            console.log('\n' + '═'.repeat(60));
            console.log('  Final Durum:');
            console.log('═'.repeat(60));
            console.log(`  Request ID: ${request.id}`);
            console.log(`  Status: ${request.status}`);
            console.log(`  Thread ID: ${request.threadId || 'N/A'}`);
            console.log(`  Type: ${request.requestDescription || 'N/A'}`);
            console.log(`  Amount: ${request.amount || 'N/A'}`);
            console.log('═'.repeat(60) + '\n');
          }
        }
      } catch (error: any) {
        log(`Final durum kontrolü hatası: ${error.message}`, 'warning');
      }
    } else {
      log('\n❌ Support Request kabul edilmedi veya timeout oldu!', 'error');
      process.exit(1);
    }

  } catch (error: any) {
    log(`Fatal error: ${error.message}`, 'error');
    if (error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  } finally {
    rl.close();
  }
}

// Script çalıştır
if (require.main === module) {
  main().catch((error) => {
    console.error('Unhandled error:', error);
    process.exit(1);
  });
}
