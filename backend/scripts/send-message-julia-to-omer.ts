/**
 * Julia kullanıcısından Georgia Green (eski Ömer) kullanıcısına mesaj gönder
 */

import axios from 'axios';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

// Constants
// Docker container içinde çalışıyorsa localhost:3000 kullan (aynı container'da çalışıyor)
// Container dışından çalışıyorsa BASE_URL env'den al veya localhost kullan
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const JULIA_EMAIL = 'julia.havk@tipbox.co';
const GEORGIA_USER_ID = '480f5de9-b691-4d70-a6a8-2789226f4e07'; // Georgia Green (eski Ömer)
const DEFAULT_PASSWORD = 'password123';

async function sendMessage() {
  try {
    console.log('🔐 Julia olarak giriş yapılıyor...\n');
    
    // 1. Login
    const loginResponse = await axios.post(`${BASE_URL}/auth/login`, {
      email: JULIA_EMAIL,
      password: DEFAULT_PASSWORD,
    });

    if (!loginResponse.data?.token) {
      console.error('❌ Giriş başarısız: Token alınamadı');
      process.exit(1);
    }

    const token = loginResponse.data.token;
    console.log('✅ Giriş başarılı!\n');

    // 2. Mesaj gönder
    const message = 'Merhaba Georgia! Nasılsın?';
    console.log(`📤 Mesaj gönderiliyor: "${message}"\n`);

    const messageResponse = await axios.post(
      `${BASE_URL}/inbox`,
      {
        recipientUserId: GEORGIA_USER_ID,
        message: message,
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (messageResponse.status === 201) {
      console.log('✅ Mesaj başarıyla gönderildi!');
      console.log(`   📝 Veritabanına kalıcı olarak yazıldı (dm_messages)`);
      console.log(`   🔔 Socket event'leri tetiklendi (new_message, message_sent)`);
    } else {
      console.error('❌ Mesaj gönderme hatası:', messageResponse.status);
    }
  } catch (error: any) {
    console.error('❌ Hata:', error.response?.data || error.message);
    if (error.response?.data) {
      console.error('   Detay:', JSON.stringify(error.response.data, null, 2));
    }
    process.exit(1);
  }
}

// Script çalıştır
sendMessage();
