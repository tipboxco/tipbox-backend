import axios from 'axios';

const BASE_URL = 'http://localhost:3000';

async function testCatalogAPI() {
  try {
    // 1. Login
    console.log('🔐 Logging in...');
    const loginResponse = await axios.post(`${BASE_URL}/auth/login`, {
      email: 'omer@tipbox.co',
      password: 'password123'
    });

    const token = loginResponse.data.token;
    
    if (!token) {
      throw new Error('Token alınamadı');
    }

    console.log('✅ Login successful\n');

    // 2. Get categories
    console.log('📋 Fetching categories...');
    const categoriesResponse = await axios.get(`${BASE_URL}/catalog/categories`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    console.log('✅ Categories response:');
    console.log(JSON.stringify(categoriesResponse.data, null, 2));

    // 3. Check if URLs are correct
    const categories = categoriesResponse.data;
    const expectedBaseUrl = 'http://192.168.1.116/media';
    
    console.log('\n🔍 Checking image URLs...');
    let allCorrect = true;
    
    for (const category of categories) {
      if (category.image) {
        const isCorrect = category.image.startsWith(expectedBaseUrl);
        console.log(`${isCorrect ? '✅' : '❌'} ${category.name}: ${category.image}`);
        if (!isCorrect) {
          allCorrect = false;
        }
      }
    }

    if (allCorrect) {
      console.log('\n🎉 Tüm image URL\'leri doğru base URL ile başlıyor!');
    } else {
      console.log('\n⚠️ Bazı image URL\'leri hala eski base URL kullanıyor!');
    }

  } catch (error: any) {
    console.error('❌ Error:', error.response?.data || error.message);
  }
}

testCatalogAPI();




