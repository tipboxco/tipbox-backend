/**
 * Login ve Token Alma Scripti
 */

const axios = require('axios');

const BASE_URL = process.env.API_URL || 'http://localhost:3000';

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

async function main() {
  const email = process.argv[2] || 'omer@tipbox.co';
  const password = process.argv[3] || 'password123';
  
  console.log(`🔐 Login deneniyor: ${email}`);
  const token = await login(email, password);
  
  if (token) {
    console.log('✅ Token alındı:');
    console.log(token);
  } else {
    console.log('❌ Token alınamadı');
  }
}

main();



