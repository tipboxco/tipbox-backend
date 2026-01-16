import axios from 'axios';

const BASE_URL = 'http://localhost:3000';
const JULIA_EMAIL = 'julia.havk@tipbox.co';
const JULIA_PASSWORD = 'password123';
const OMER_EMAIL = 'omer@tipbox.co';

async function main() {
  console.log('========================================');
  console.log('Julia Havk -> Ömer Mesaj Gönderme Testi');
  console.log('========================================\n');

  // 1. Julia ile login
  console.log('[1/3] Julia Havk ile login yapılıyor...');
  let juliaToken: string;
  let juliaUserId: string;
  
  try {
    const loginResponse = await axios.post(`${BASE_URL}/auth/login`, {
      email: JULIA_EMAIL,
      password: JULIA_PASSWORD,
    });
    
    juliaToken = loginResponse.data.token;
    juliaUserId = loginResponse.data.id;
    console.log(`✓ Login başarılı - Julia User ID: ${juliaUserId}\n`);
  } catch (error: any) {
    console.error('✗ Login başarısız:', error.response?.data?.message || error.message);
    process.exit(1);
  }

  // 2. Ömer kullanıcısını bul
  console.log('[2/3] Ömer kullanıcısı aranıyor...');
  let omerUserId: string;
  
  try {
    const searchResponse = await axios.get(`${BASE_URL}/search?keyword=omer&types=user&limit=10`, {
      headers: {
        Authorization: `Bearer ${juliaToken}`,
      },
    });
    
    const users = searchResponse.data?.userData || [];
    const omerUser = users.find((u: any) => 
      u.email === OMER_EMAIL || u.email?.toLowerCase().includes('omer')
    );
    
    if (omerUser) {
      omerUserId = omerUser.id;
      console.log(`✓ Ömer bulundu - User ID: ${omerUserId}`);
      console.log(`  Email: ${omerUser.email || 'N/A'}`);
      console.log(`  Name: ${omerUser.name || 'N/A'}\n`);
    } else {
      // Direkt email ile dene
      console.log('⚠ Search\'te bulunamadı, direkt email ile denenecek...');
      // Login response'dan alabiliriz veya başka bir yöntem
      throw new Error('Ömer kullanıcısı bulunamadı');
    }
  } catch (error: any) {
    console.error('✗ Ömer kullanıcısı bulunamadı:', error.message);
    // Alternatif: Ömer'in bilinen ID'sini kullan (test dosyalarından)
    omerUserId = '480f5de9-b691-4d70-a6a8-2789226f4e07';
    console.log(`⚠ Bilinen Ömer ID kullanılıyor: ${omerUserId}\n`);
  }

  // 3. Julia'dan Ömer'e mesaj gönder
  console.log('[3/3] Julia\'dan Ömer\'e mesaj gönderiliyor...');
  try {
    const messageResponse = await axios.post(
      `${BASE_URL}/messages`,
      {
        recipientUserId: omerUserId,
        message: 'Merhaba Ömer! Bu mesaj Julia Havk tarafından gönderildi. 🚀'
      },
      {
        headers: {
          Authorization: `Bearer ${juliaToken}`,
          'Content-Type': 'application/json',
        },
      }
    );
    
    if (messageResponse.status === 201) {
      console.log('✓ Mesaj başarıyla gönderildi!');
      console.log(`  Gönderen: Julia Havk (${juliaUserId})`);
      console.log(`  Alıcı: Ömer (${omerUserId})`);
      console.log(`  Status: ${messageResponse.status}`);
    } else {
      console.log(`⚠ Beklenmeyen status: ${messageResponse.status}`);
    }
  } catch (error: any) {
    console.error('✗ Mesaj gönderme hatası:', error.response?.data?.message || error.message);
    if (error.response?.data) {
      console.error('  Response:', JSON.stringify(error.response.data, null, 2));
    }
    process.exit(1);
  }

  console.log('\n========================================');
  console.log('Test Tamamlandı!');
  console.log('========================================\n');
}

main().catch((error) => {
  console.error('Test hatası:', error);
  process.exit(1);
});








